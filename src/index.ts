/// <reference types="@cloudflare/workers-types" />
// @ts-ignore
declare const HTMLRewriter: any;
// @ts-ignore
declare const WebSocketPair: any;

export interface Env {
    GITHUB_OWNER: string;
    GITHUB_REPO: string;
    GITHUB_BRANCH: string;
    GITHUB_TOKEN: string;
    CONFIG_KV: KVNamespace; // Binding for Cloudflare KV
    DB: any;          // Binding for Cloudflare D1 (SQL)
    ADMIN_TOKEN?: string;   // Optional admin token for dashboard
    HUB_CONNECTOR: DurableObjectNamespace;
}

export class HubConnector {
    state: DurableObjectState;
    env: Env;
    hubWs: WebSocket | null = null;
    sessions: Set<WebSocket> = new Set();
    latestData: string = "{}";

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.env = env;
    }

    async fetch(request: Request) {
        const url = new URL(request.url);
        if (url.pathname === "/connect-hub") {
            return this.setupHubConnection();
        }

        if (request.headers.get("Upgrade") === "websocket") {
            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);
            this.handleSession(server);
            return new Response(null, { status: 101, webSocket: client });
        }

        return new Response("HubConnector active", { status: 200 });
    }

    async setupHubConnection() {
        const hubConfigStr = await this.env.CONFIG_KV.get('hub_config');
        if (!hubConfigStr) return new Response("Hub config missing", { status: 400 });
        const { url, secret } = JSON.parse(hubConfigStr);

        try {
            const resp = await fetch(url, {
                headers: {
                    "Upgrade": "websocket",
                    "X-Hub-Secret": secret
                }
            });
            const ws = resp.webSocket;
            if (!ws) return new Response("Failed to upgrade to WebSocket", { status: 500 });

            ws.accept();
            this.hubWs = ws;
            
            ws.addEventListener("message", (msg) => {
                this.latestData = msg.data as string;
                this.broadcast(this.latestData);
            });

            ws.addEventListener("close", () => {
                this.hubWs = null;
                // Auto-reconnect after 5s
                setTimeout(() => this.setupHubConnection(), 5000);
            });

            return new Response("Connected to Hub", { status: 200 });
        } catch (e: any) {
            return new Response("Hub Connection Error: " + e.message, { status: 500 });
        }
    }

    handleSession(ws: WebSocket) {
        ws.accept();
        this.sessions.add(ws);
        
        // Send latest data immediately
        ws.send(this.latestData);

        ws.addEventListener("close", () => {
            this.sessions.delete(ws);
        });
    }

    broadcast(data: string) {
        for (const session of this.sessions) {
            try {
                session.send(data);
            } catch (e) {
                this.sessions.delete(session);
            }
        }
    }
}

async function recordLog(env: Env, msg: string, node?: string) {
    try {
        await env.DB.prepare('INSERT INTO logs (msg, node) VALUES (?, ?)')
            .bind(msg, node || null)
            .run();
    } catch (e) {
        console.error("Failed to record log to D1:", e);
    }
}

// --- Google Auth Helpers ---
async function getGoogleOAuthToken(clientId: string, clientSecret: string, refreshToken: string) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken
        })
    });

    const data: any = await res.json();
    if (!data.access_token) {
        throw new Error(`OAuth2 Refresh failed: ${data.error_description || JSON.stringify(data)}`);
    }
    return data.access_token;
}

async function getWorkstationToken(env: any, resourceName: string) {
    const masterStr = await env.CONFIG_KV.get('google_oauth_creds');
    if (!masterStr) throw new Error("Google OAuth2 Master Settings (Client ID/Secret) missing.");
    const master = JSON.parse(masterStr);

    const accountsStr = await env.CONFIG_KV.get('gcp_configs');
    const accounts: any[] = accountsStr ? JSON.parse(accountsStr) : [];

    if (accounts.length === 0) {
        throw new Error("No Google Accounts authorized. Go to 'OAuth2 Accounts' and Login.");
    }

    let lastError = "";
    for (const acc of accounts) {
        try {
            const googleToken = await getGoogleOAuthToken(master.client_id, master.client_secret, acc.refresh_token);
            
            const wsUrl = `https://workstations.googleapis.com/v1beta/${resourceName}:generateAccessToken`;
            const wsRes = await fetch(wsUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${googleToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ttl: "86400s" })
            });

            const wsData: any = await wsRes.json();
            if (wsData.accessToken) {
                return {
                    token: wsData.accessToken,
                    expires: Math.floor(new Date(wsData.expireTime).getTime() / 1000),
                    projectId: acc.project_id || 'oauth2'
                };
            } else if (wsData.error) {
                lastError = `${acc.email}: ${wsData.error.message}`;
            }
        } catch (e: any) {
            lastError = `${acc.email}: ${e.message}`;
        }
    }
    throw new Error(lastError || "All authorized accounts failed to generate token.");
}

async function ensureWorkstationToken(env: any, hostname: string) {
    const metaDataStr = await env.CONFIG_KV.get('node_metadata');
    let meta = metaDataStr ? JSON.parse(metaDataStr) : {};
    const nodeMeta = meta[hostname];

    if (!nodeMeta || !nodeMeta.name) return null;

    const now = Math.floor(Date.now() / 1000);
    // Check if token exists and still valid for > 2 hours
    if (nodeMeta.token && nodeMeta.token_expires && nodeMeta.token_expires > now + 7200) {
        return nodeMeta.token;
    }

    const result = await getWorkstationToken(env, nodeMeta.name);
    if (result) {
        nodeMeta.token = result.token;
        nodeMeta.token_expires = result.expires;
        nodeMeta.preferred_sa = result.projectId;
        nodeMeta.updated_at = new Date().toISOString();

        meta[hostname] = nodeMeta;
        await env.CONFIG_KV.put('node_metadata', JSON.stringify(meta));


        return result.token;
    }
    return null;
}

async function fetchGithubFile(path: string, env: Env, isJson: boolean = true): Promise<any | null> {
    const url = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH}/${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "Authorization": `token ${env.GITHUB_TOKEN}`,
                "Accept": "application/vnd.github.v3.raw",
                "User-Agent": "Cloudflare-Worker",
                "Cache-Control": "no-cache"
            }
        });
        clearTimeout(timeoutId);
        if (!response.ok) return null;
        return isJson ? await response.json() : await response.text();
    } catch (error) {
        clearTimeout(timeoutId);
        return null;
    }
}

function resolvePlaceholders(text: string, config: any): string {
    return text.replace(/{{([\w:.-]+)}}/g, (match: string, key: string) => {
        const value = config[key] !== undefined ? config[key] : (config[key.toLowerCase()] !== undefined ? config[key.toLowerCase()] : undefined);
        return value !== undefined ? String(value) : match;
    });
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const hostname = url.searchParams.get('hostname');

        if (url.pathname === '/api/ws-hub') {
            const id = env.HUB_CONNECTOR.idFromName("global");
            const stub = env.HUB_CONNECTOR.get(id);
            return stub.fetch(request);
        }

        if (url.pathname === '/api/reconnect-hub' && isAuthorized) {
            const id = env.HUB_CONNECTOR.idFromName("global");
            const stub = env.HUB_CONNECTOR.get(id);
            return stub.fetch(new Request(`${url.origin}/connect-hub`));
        }

        if (url.pathname === '/' && request.method === 'GET') {
            const html = await fetchGithubFile('index.html', env, false);
            return new Response(html, { headers: { "Content-Type": "text/html" } });
        }

        if (url.pathname === '/src/dashboard/style.css') {
            const css = await fetchGithubFile('src/dashboard/style.css', env, false);
            return new Response(css, { headers: { "Content-Type": "text/css" } });
        }

        if (url.pathname.startsWith('/src/dashboard/') && url.pathname.endsWith('.js')) {
            const fileName = url.pathname.split('/').pop();
            const js = await fetchGithubFile(`src/dashboard/${fileName}`, env, false);
            return new Response(js, { headers: { "Content-Type": "application/javascript" } });
        }

        if (url.pathname === '/config' && hostname) {
            try {
                const [kvNodeData, kvGlobalData] = await Promise.all([
                    env.CONFIG_KV.get(`node:${hostname}`),
                    env.CONFIG_KV.get('global')
                ]);

                let kvNodeJson: any = null;
                let kvGlobalJson: any = null;
                if (kvNodeData) { try { kvNodeJson = JSON.parse(kvNodeData); } catch (e) { } }
                if (kvGlobalData) { try { kvGlobalJson = JSON.parse(kvGlobalData); } catch (e) { } }

                const registryData = await env.CONFIG_KV.get('registry');
                const registryJson: Record<string, string> = registryData ? JSON.parse(registryData) : {};
                const registryConfig: Record<string, string> = {};
                for (const [key, value] of Object.entries(registryJson)) {
                    registryConfig[`host:${key}`] = value;
                }

                const ipsData = await env.CONFIG_KV.get('ips');
                const ipsJson: Record<string, string> = ipsData ? JSON.parse(ipsData) : {};
                const ipConfig: Record<string, string> = {};
                if (ipsJson[hostname]) ipConfig['IP'] = ipsJson[hostname];
                for (const [key, value] of Object.entries(ipsJson)) {
                    ipConfig[`ip:${key}`] = value;
                }

                const cloudConfig: Record<string, string> = {};
                const kvKeys = await env.CONFIG_KV.list();
                for (const k of kvKeys.keys.filter((key: { name: string }) => key.name.startsWith('cloud:'))) {
                    const val = await env.CONFIG_KV.get(k.name);
                    if (val) cloudConfig[k.name] = val;
                }

                const groupsMappingData = await env.CONFIG_KV.get('groups');
                let centralGroupName: string | null = null;
                if (groupsMappingData) {
                    try {
                        const groups = JSON.parse(groupsMappingData);
                        if (Array.isArray(groups)) {
                            for (const g of groups) {
                                const nodeList = (g.listnode || "").split(',').map((s: string) => s.trim());
                                if (nodeList.includes(hostname)) {
                                    centralGroupName = g.config;
                                    break;
                                }
                            }
                        }
                    } catch (e) { }
                }

                const [gitGlobalJson, gitNodeJson] = await Promise.all([
                    fetchGithubFile('configs/global.json', env),
                    fetchGithubFile(`configs/${hostname}.json`, env)
                ]);

                const nodePart: any = { ...(gitNodeJson || {}), ...(kvNodeJson || {}) };
                const groupName = nodePart.group || nodePart.GROUP || centralGroupName;

                let gitGroupJson: any = null;
                let kvGroupJson: any = null;
                if (groupName) {
                    const [kvGroupData, gitGroupData] = await Promise.all([
                        env.CONFIG_KV.get(`group:${groupName}`),
                        fetchGithubFile(`configs/groups/${groupName}.json`, env)
                    ]);
                    if (kvGroupData) { try { kvGroupJson = JSON.parse(kvGroupData); } catch (e) { } }
                    gitGroupJson = gitGroupData;
                }

                const mergedConfig: any = {
                    ...(gitGlobalJson || {}),
                    ...(kvGlobalJson || {}),
                    ...(gitGroupJson || {}),
                    ...(kvGroupJson || {}),
                    ...nodePart,
                    ...registryConfig,
                    ...ipConfig,
                    ...cloudConfig,
                    hostname,
                    WORKER_URL: new URL(request.url).origin,
                    ADMIN_TOKEN: env.ADMIN_TOKEN || ""
                };

                if (mergedConfig.template) {
                    const templateName = mergedConfig.template;
                    let templateContent = await env.CONFIG_KV.get(`template:${templateName}`);
                    if (!templateContent) templateContent = await fetchGithubFile(`templates/${templateName}.sh`, env, false);

                    if (templateContent) {
                        const placeholderSet = new Set<string>();
                        const scanRegex = /{{([\w:.-]+)}}/g;
                        const scanText = (text: string) => {
                            let match;
                            while ((match = scanRegex.exec(text)) !== null) placeholderSet.add(match[1]);
                        };
                        for (const key in mergedConfig) {
                            if (typeof mergedConfig[key] === 'string') scanText(mergedConfig[key]);
                        }
                        scanText(templateContent);
                        const keysToFetch = Array.from(placeholderSet).filter(k => mergedConfig[k] === undefined && mergedConfig[k.toLowerCase()] === undefined);
                        if (keysToFetch.length > 0) {
                            const kvResults = await Promise.all(keysToFetch.map(k => env.CONFIG_KV.get(k)));
                            keysToFetch.forEach((k, i) => { if (kvResults[i] !== null) mergedConfig[k] = kvResults[i]; });
                        }
                        for (const key in mergedConfig) {
                            if (typeof mergedConfig[key] === 'string') mergedConfig[key] = resolvePlaceholders(mergedConfig[key], mergedConfig);
                        }
                        templateContent = resolvePlaceholders(templateContent, mergedConfig);
                        return new Response(templateContent, { headers: { "Content-Type": "text/x-shellscript" } });
                    }
                }
                return new Response(JSON.stringify(mergedConfig, null, 2), { headers: { "Content-Type": "application/json" } });
            } catch (error: any) {
                return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
            }
        }

        if (url.pathname === '/register' && request.method === 'POST') {
            try {
                const body: any = await request.json();
                const { hostname: regHostname, host: regHost, name: regName } = body;
                if (!regHostname || !regHost) return new Response(JSON.stringify({ error: "Missing hostname or host" }), { status: 400 });

                // Update Registry (Standard structure)
                const registryData = await env.CONFIG_KV.get('registry');
                const registryJson = registryData ? JSON.parse(registryData) : {};
                registryJson[regHostname] = regHost;
                await env.CONFIG_KV.put('registry', JSON.stringify(registryJson));

                // Update Metadata (Optional additional info)
                if (regName) {
                    const metaData = await env.CONFIG_KV.get('node_metadata');
                    const metaJson = metaData ? JSON.parse(metaData) : {};
                    metaJson[regHostname] = { name: regName, updated_at: new Date().toISOString() };
                    await env.CONFIG_KV.put('node_metadata', JSON.stringify(metaJson));
                }

                await recordLog(env, `New node registered: ${regHostname}`, regHostname);
                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
            } catch (error: any) {
                return new Response(JSON.stringify({ error: "Failed to register node" }), { status: 500 });
            }
        }

        const authHeader = request.headers.get('Authorization');
        const queryToken = url.searchParams.get('token');
        const isAuthorized = (env.ADMIN_TOKEN && (authHeader === env.ADMIN_TOKEN || queryToken === env.ADMIN_TOKEN));

        if (url.pathname.startsWith('/terminal-proxy/')) {
            const parts = url.pathname.split('/');
            const requestToken = parts[2];
            const nodeHostname = parts[3];
            const remainingPath = parts.slice(4).join('/');
            const fullUrl = remainingPath + url.search;

            if (env.ADMIN_TOKEN && requestToken !== env.ADMIN_TOKEN) return new Response("Unauthorized", { status: 401 });

            const registryData = await env.CONFIG_KV.get('registry');
            const registry = registryData ? JSON.parse(registryData) : {};
            const host = registry[nodeHostname];
            if (!host) return new Response("Node not found", { status: 404 });

            // Switch port based on path: Terminal usually 8877, FileBrowser uses /api/ or /static/ on 2234
            let port = "8877";
            if (remainingPath.startsWith('api/') || remainingPath.startsWith('static/')) {
                port = "2234";
            }

            const targetUrl = `https://${port}-${host}/${fullUrl}`;

            const headers = new Headers(request.headers);
            headers.set('Host', `${port}-${host}`);
            headers.set('Origin', `https://${port}-${host}`);

            // Add Workstation Token logic
            const metaData = await env.CONFIG_KV.get('node_metadata');
            const meta = metaData ? JSON.parse(metaData) : {};
            if (meta[nodeHostname]?.name) {
                try {
                    const wsToken = await ensureWorkstationToken(env, nodeHostname);
                    if (wsToken) {
                        headers.set("Authorization", `Bearer ${wsToken}`);
                        headers.set("Cookie", `WorkstationJwtPartitioned=${wsToken}`);
                    }
                } catch (e) {
                    console.error("Terminal Proxy Token Error:", e);
                }
            }

            if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
                return fetch(targetUrl, { headers });
            }

            // Forward original method and body so FileBrowser API
            // receives correct POST/DELETE/PATCH requests instead
            // of everything becoming a GET (which caused 404 errors
            // for upload/copy/delete/move).
            const init: RequestInit = {
                method: request.method,
                headers,
            };

            // Only attach body for methods that can carry one
            if (request.method !== 'GET' && request.method !== 'HEAD') {
                init.body = request.body;
            }

            const response = await fetch(targetUrl, init);
            const newHeaders = new Headers(response.headers);
            newHeaders.delete('Content-Security-Policy');
            newHeaders.delete('X-Frame-Options');
            newHeaders.set('Access-Control-Allow-Origin', '*');
            return new Response(response.body, { status: response.status, headers: newHeaders });
        }

        if (url.pathname.startsWith('/api/') && url.pathname !== '/api/oauth-callback' && !isAuthorized) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

        if (url.pathname === '/api/heartbeat' && request.method === 'POST') {
            try {
                const body: any = await request.json();
                const { hostname: h, cpu, ram, uptime } = body;
                if (!h) return new Response("Missing hostname", { status: 400 });

                // Ensure table exists
                await env.DB.prepare(`
                    CREATE TABLE IF NOT EXISTS node_status (
                        hostname TEXT PRIMARY KEY,
                        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                        ip TEXT,
                        cpu REAL,
                        ram REAL,
                        uptime TEXT
                    )
                `).run();

                const ip = request.headers.get('cf-connecting-ip') || '';
                await env.DB.prepare(`
                    INSERT INTO node_status (hostname, last_seen, ip, cpu, ram, uptime)
                    VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?)
                    ON CONFLICT(hostname) DO UPDATE SET
                        last_seen = CURRENT_TIMESTAMP,
                        ip = excluded.ip,
                        cpu = excluded.cpu,
                        ram = excluded.ram,
                        uptime = excluded.uptime
                `).bind(h, ip, cpu || null, ram || null, uptime || null).run();

                return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
            } catch (error: any) {
                return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            }
        }

        if (url.pathname === '/api/data' && request.method === 'GET') {
            const [registryData, groupsMappingData, metaData, gcpConfigsData, allKeys, offlineThresholdData] = await Promise.all([
                env.CONFIG_KV.get('registry'),
                env.CONFIG_KV.get('groups'),
                env.CONFIG_KV.get('node_metadata'),
                env.CONFIG_KV.get('gcp_configs'),
                env.CONFIG_KV.list(),
                env.CONFIG_KV.get('offline_threshold')
            ]);

            // Fetch statuses from D1
            let statuses: any[] = [];
            try {
                const { results } = await env.DB.prepare("SELECT * FROM node_status").all();
                statuses = results;
            } catch (e) {
                console.error("Failed to fetch node_status from D1:", e);
            }

            const keys = allKeys.keys.map((k: { name: string }) => k.name);
            const templates = keys.filter((k: string) => k.startsWith('template:'));
            const groupConfigs = keys.filter((k: string) => k.startsWith('group:'));
            const nodeConfigs = keys.filter((k: string) => k.startsWith('node:'));
            const certConfigs = keys.filter((k: string) => k.startsWith('cert:'));
            const cloudConfigs = keys.filter((k: string) => k.startsWith('cloud:'));
            const ipsData = await env.CONFIG_KV.get('ips');
            
            return new Response(JSON.stringify({
                registry: registryData ? JSON.parse(registryData) : {},
                node_metadata: metaData ? JSON.parse(metaData) : {},
                node_statuses: statuses, // New field from D1
                gcp_configs: gcpConfigsData ? JSON.parse(gcpConfigsData) : {},
                groups: groupsMappingData ? JSON.parse(groupsMappingData) : [],
                templates, groupConfigs, nodeConfigs, certConfigs, cloudConfigs,
                ips: ipsData ? JSON.parse(ipsData) : {},
                hasGlobal: keys.includes('global'),
                offline_threshold: offlineThresholdData ? parseInt(offlineThresholdData) : 10
            }), { headers: { "Content-Type": "application/json" } });
        }

        if (url.pathname === '/api/gcp-config' && request.method === 'POST') {
            try {
                const { saJson } = await request.json() as any;
                if (!saJson || !saJson.project_id) return new Response(JSON.stringify({ error: "Invalid SA JSON" }), { status: 400 });
                const currentData = await env.CONFIG_KV.get('gcp_configs');
                const configs = currentData ? JSON.parse(currentData) : {};
                configs[saJson.project_id] = saJson;
                await env.CONFIG_KV.put('gcp_configs', JSON.stringify(configs));
                return new Response(JSON.stringify({ success: true }));
            } catch (e) {
                return new Response(JSON.stringify({ error: "Failed to save config" }), { status: 500 });
            }
        }

        if (url.pathname === '/api/gcp-config' && request.method === 'DELETE') {
            const projectId = url.searchParams.get('projectId');
            if (!projectId) return new Response(JSON.stringify({ error: "Missing projectId" }), { status: 400 });
            const currentData = await env.CONFIG_KV.get('gcp_configs');
            const configs = currentData ? JSON.parse(currentData) : {};
            delete configs[projectId];
            await env.CONFIG_KV.put('gcp_configs', JSON.stringify(configs));
            return new Response(JSON.stringify({ success: true }));
        }

        if (url.pathname === '/api/logs' && request.method === 'GET') {
            const nodeFilter = url.searchParams.get('hostname');
            const dateFilter = url.searchParams.get('date');
            const limit = parseInt(url.searchParams.get('limit') || '100');
            const offset = parseInt(url.searchParams.get('offset') || '0');
            try {
                let query = 'SELECT * FROM logs';
                let params: any[] = [];
                let conditions: string[] = [];
                if (nodeFilter) { conditions.push('(node = ? OR msg LIKE ?)'); params.push(nodeFilter, `%${nodeFilter}%`); }
                if (dateFilter) { conditions.push("time < DATE(?, '+1 day')"); params.push(dateFilter); }
                if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
                query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
                params.push(limit, offset);
                const { results } = await env.DB.prepare(query).bind(...params).all();
                return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
            } catch (e) { return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } }); }
        }

        if (url.pathname === '/api/get-master-creds' && request.method === 'GET') {
            const creds = await env.CONFIG_KV.get('google_oauth_creds');
            return new Response(creds || "{}");
        }

        if (url.pathname === '/api/save-master-creds' && request.method === 'POST') {
            const { client_id, client_secret } = await request.json() as any;
            if (!client_id || !client_secret) return new Response("Missing parameters", { status: 400 });
            await env.CONFIG_KV.put('google_oauth_creds', JSON.stringify({ client_id, client_secret }));
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        }

        if (url.pathname === '/api/google-auth-url' && request.method === 'GET') {
            const masterStr = await env.CONFIG_KV.get('google_oauth_creds');
            if (!masterStr) return new Response("Master Settings Missing", { status: 400 });
            const { client_id } = JSON.parse(masterStr);

            const redirectUri = `${url.origin}/api/oauth-callback`;
            const scope = "openid email https://www.googleapis.com/auth/cloud-platform";
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
            
            return new Response(JSON.stringify({ url: authUrl }), { headers: { "Content-Type": "application/json" } });
        }

        if (url.pathname === '/api/oauth-callback' && request.method === 'GET') {
            const code = url.searchParams.get('code');
            if (!code) return new Response("No code provided", { status: 400 });

            const masterStr = await env.CONFIG_KV.get('google_oauth_creds');
            const { client_id, client_secret } = JSON.parse(masterStr!);
            const redirectUri = `${url.origin}/api/oauth-callback`;

            // Exchange code for token
            const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    code: code,
                    client_id: client_id,
                    client_secret: client_secret,
                    redirect_uri: redirectUri,
                    grant_type: "authorization_code"
                })
            });

            const tokenData: any = await tokenRes.json();
            if (!tokenData.refresh_token) {
                return new Response("Failed to get refresh token. Please ensure 'access_type=offline' and 'prompt=consent'.", { status: 500 });
            }

            // Get user info (email)
            const idToken = tokenData.id_token;
            const payload = JSON.parse(atob(idToken.split('.')[1]));
            const email = payload.email;

            // Save to accounts list
            const accountsStr = await env.CONFIG_KV.get('gcp_configs');
            let accounts: any[] = accountsStr ? JSON.parse(accountsStr) : [];
            
            // Remove existing if same email
            accounts = accounts.filter(a => a.email !== email);
            accounts.push({
                email,
                refresh_token: tokenData.refresh_token,
                added_at: new Date().toISOString()
            });

            await env.CONFIG_KV.put('gcp_configs', JSON.stringify(accounts));

            return new Response(`
                <html>
                <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0a0a0f; color: white;">
                    <div style="text-align: center; border: 1px solid #333; padding: 2rem; border-radius: 1rem; background: rgba(255,255,255,0.05);">
                        <h2 style="color: #4CAF50;">Success!</h2>
                        <p>Authorized as <b>${email}</b></p>
                        <p style="opacity: 0.7;">You can close this window and refresh the dashboard.</p>
                        <button onclick="window.close()" style="background: #4CAF50; border: none; color: white; padding: 0.8rem 1.5rem; border-radius: 0.5rem; cursor: pointer; margin-top: 1rem;">Close Window</button>
                    </div>
                </body>
                </html>
            `, { headers: { "Content-Type": "text/html" } });
        }

        if (url.pathname === '/api/delete-oauth-account' && request.method === 'POST') {
            const { email } = await request.json() as any;
            const accountsStr = await env.CONFIG_KV.get('gcp_configs');
            let accounts: any[] = accountsStr ? JSON.parse(accountsStr) : [];
            accounts = accounts.filter(a => a.email !== email);
            await env.CONFIG_KV.put('gcp_configs', JSON.stringify(accounts));
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        }

        if (url.pathname === '/api/record-log' && request.method === 'POST') {
            const { msg, node } = await request.json() as any;
            if (msg) await recordLog(env, msg, node);
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        }

        if (url.pathname === '/api/get-kv' && request.method === 'GET') {
            const key = url.searchParams.get('key');
            if (!key) return new Response("Key required", { status: 400 });
            return new Response(await env.CONFIG_KV.get(key) || "");
        }

        if (url.pathname === '/api/save' && request.method === 'POST') {
            const { key, value } = await request.json() as any;
            if (!key) return new Response("Key required", { status: 400 });
            await env.CONFIG_KV.put(key, value);
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        }

        if (url.pathname === '/api/delete' && request.method === 'POST') {
            const { key } = await request.json() as any;
            if (!key) return new Response("Key required", { status: 400 });
            await env.CONFIG_KV.delete(key);
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        }

        if (url.pathname === '/api/node-proxy') {
            const hostname = url.searchParams.get('hostname');
            const endpoint = url.searchParams.get('endpoint');
            if (!hostname || !endpoint) return new Response("Missing parameters", { status: 400 });

            const registryData = await env.CONFIG_KV.get('registry');
            const registry = registryData ? JSON.parse(registryData) : {};
            const host = registry[hostname];
            if (!host) return new Response("Node not found", { status: 404 });

            let authHeader: Record<string, string> = { "X-API-Key": "diamon" };
            const metaData = await env.CONFIG_KV.get('node_metadata');
            const meta = metaData ? JSON.parse(metaData) : {};
            const resourceName = meta[hostname]?.name;

            if (resourceName) {
                try {
                    const wsToken = await ensureWorkstationToken(env, hostname);
                    if (wsToken) {
                        authHeader["Authorization"] = `Bearer ${wsToken}`;
                        authHeader["Cookie"] = `WorkstationJwtPartitioned=${wsToken}`;
                    }
                } catch (e) {
                    console.error("Failed to fetch WS token:", e);
                }
            }

            let sanitizedHost = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
            let targetUrl = `https://${sanitizedHost}/${endpoint}`;

            if (endpoint === 'nodeinfo') {
                if (!sanitizedHost.startsWith('8080-')) sanitizedHost = '8080-' + sanitizedHost;
                targetUrl = `https://${sanitizedHost}/`;
            } else if (endpoint === 'logs') {
                if (!sanitizedHost.startsWith('8080-')) sanitizedHost = '8080-' + sanitizedHost;
                targetUrl = `https://${sanitizedHost}/logs`;
            } else {
                targetUrl = `https://${sanitizedHost}/${endpoint}`;
            }

            try {
                const resp = await fetch(targetUrl, { headers: authHeader });
                return new Response(resp.body, { status: resp.status, headers: resp.headers });
            } catch (e) {
                return new Response("Proxy error: " + e, { status: 502 });
            }
        }

        if (url.pathname === '/api/init-all-tokens' && request.method === 'POST') {
            try {
                const registryData = await env.CONFIG_KV.get('registry');
                const registry = registryData ? JSON.parse(registryData) : {};
                const hostnames = Object.keys(registry);

                const metaDataStr = await env.CONFIG_KV.get('node_metadata');
                let meta = metaDataStr ? JSON.parse(metaDataStr) : {};

                const results: any = { success: 0, failed: 0, skipped: 0, errors: [] };
                const now = Math.floor(Date.now() / 1000);
                let changed = false;

                for (const h of hostnames) {
                    const nodeMeta = meta[h];
                    if (!nodeMeta || !nodeMeta.name) {
                        results.skipped++;
                        continue;
                    }

                    if (nodeMeta.token && nodeMeta.token_expires && nodeMeta.token_expires > now + 7200) {
                        results.skipped++;
                        continue;
                    }

                    try {
                        const result = await getWorkstationToken(env, nodeMeta.name);
                        if (result) {
                            nodeMeta.token = result.token;
                            nodeMeta.token_expires = result.expires;
                            nodeMeta.preferred_sa = result.projectId;
                            nodeMeta.updated_at = new Date().toISOString();
                            meta[h] = nodeMeta;
                            changed = true;
                            results.success++;
                        } else {
                            results.failed++;
                            results.errors.push(`${h}: All SAs failed or no SAs configured.`);
                        }
                    } catch (err) {
                        results.failed++;
                        results.errors.push(`${h}: ${String(err)}`);
                    }
                }

                if (changed) {
                    await env.CONFIG_KV.put('node_metadata', JSON.stringify(meta));
                }

                return new Response(JSON.stringify({ ...results, success_total: results.success }), { headers: { "Content-Type": "application/json" } });
            } catch (e) {
                return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
            }
        }

        if (url.pathname === '/api/batch-check-nodes' && request.method === 'GET') {
            const offset = parseInt(url.searchParams.get('offset') || '0');
            const limit = parseInt(url.searchParams.get('limit') || '50');
            const registryData = await env.CONFIG_KV.get('registry');
            const registry = registryData ? JSON.parse(registryData) : {};
            const hostnames = Object.keys(registry).slice(offset, offset + limit);
            const statusMap: Record<string, boolean> = {};
            await Promise.all(hostnames.map(async (h) => {
                const host = registry[h];
                try {
                    let sanitizedHost = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
                    if (!sanitizedHost.startsWith('8080-')) sanitizedHost = '8080-' + sanitizedHost;
                    const resp = await fetch(`https://${sanitizedHost}`, { headers: { "X-API-Key": "diamon" }, signal: AbortSignal.timeout(10000) });
                    statusMap[h] = resp.status !== 404;
                } catch (e) { statusMap[h] = false; }
            }));
            return new Response(JSON.stringify(statusMap), { headers: { "Content-Type": "application/json" } });
        }

        return new Response("VPS Metadata Server - Dashboard Ready.", { status: 200 });
    }
};
