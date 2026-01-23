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

        if (url.pathname === '/' && request.method === 'GET') {
            const html = await fetchGithubFile('index.html', env, false);
            return new Response(html, { headers: { "Content-Type": "text/html" } });
        }

        if (url.pathname === '/src/dashboard/style.css') {
            const css = await fetchGithubFile('src/dashboard/style.css', env, false);
            return new Response(css, { headers: { "Content-Type": "text/css" } });
        }

        if (url.pathname === '/src/dashboard/main.js') {
            const js = await fetchGithubFile('src/dashboard/main.js', env, false);
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
                const { hostname: regHostname, host: regHost } = body;
                if (!regHostname || !regHost) return new Response(JSON.stringify({ error: "Missing hostname or host" }), { status: 400 });
                const registryData = await env.CONFIG_KV.get('registry');
                const registryJson = registryData ? JSON.parse(registryData) : {};
                registryJson[regHostname] = regHost;
                await env.CONFIG_KV.put('registry', JSON.stringify(registryJson));
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
            const remainingPath = parts.slice(4).join('/') + url.search;
            if (env.ADMIN_TOKEN && requestToken !== env.ADMIN_TOKEN) return new Response("Unauthorized", { status: 401 });
            const registryData = await env.CONFIG_KV.get('registry');
            const registry = registryData ? JSON.parse(registryData) : {};
            const host = registry[nodeHostname];
            if (!host) return new Response("Node not found", { status: 404 });
            const targetUrl = `https://8877-${host}/${remainingPath}`;
            if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
                const proxyHeaders = new Headers(request.headers);
                proxyHeaders.set('Host', `8877-${host}`);
                proxyHeaders.set('Origin', `https://8877-${host}`);
                return fetch(targetUrl, { headers: proxyHeaders });
            }
            const headers = new Headers(request.headers);
            headers.set('Host', `8877-${host}`);
            headers.set('Origin', `https://8877-${host}`);
            const response = await fetch(targetUrl, { headers });
            const newHeaders = new Headers(response.headers);
            newHeaders.delete('Content-Security-Policy');
            newHeaders.delete('X-Frame-Options');
            newHeaders.set('Access-Control-Allow-Origin', '*');
            return new Response(response.body, { status: response.status, headers: newHeaders });
        }

        if (url.pathname.startsWith('/api/') && !isAuthorized) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

        if (url.pathname === '/api/data' && request.method === 'GET') {
            const [registryData, groupsMappingData, allKeys] = await Promise.all([env.CONFIG_KV.get('registry'), env.CONFIG_KV.get('groups'), env.CONFIG_KV.list()]);
            const keys = allKeys.keys.map((k: { name: string }) => k.name);
            const templates = keys.filter((k: string) => k.startsWith('template:'));
            const groupConfigs = keys.filter((k: string) => k.startsWith('group:'));
            const nodeConfigs = keys.filter((k: string) => k.startsWith('node:'));
            const certConfigs = keys.filter((k: string) => k.startsWith('cert:'));
            const cloudConfigs = keys.filter((k: string) => k.startsWith('cloud:'));
            const ipsData = await env.CONFIG_KV.get('ips');
            return new Response(JSON.stringify({
                registry: registryData ? JSON.parse(registryData) : {},
                groups: groupsMappingData ? JSON.parse(groupsMappingData) : [],
                templates, groupConfigs, nodeConfigs, certConfigs, cloudConfigs,
                ips: ipsData ? JSON.parse(ipsData) : {},
                hasGlobal: keys.includes('global')
            }), { headers: { "Content-Type": "application/json" } });
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

        if (url.pathname === '/api/node-proxy' && request.method === 'GET') {
            const hostname = url.searchParams.get('hostname');
            const endpoint = url.searchParams.get('endpoint');
            if (!hostname || !endpoint) return new Response("Missing params", { status: 400 });
            const registryData = await env.CONFIG_KV.get('registry');
            const registry = registryData ? JSON.parse(registryData) : {};
            const host = registry[hostname];
            if (!host) return new Response("Node not found", { status: 404 });
            try {
                let sanitizedHost = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
                if (!sanitizedHost.startsWith('31465-')) sanitizedHost = '31465-' + sanitizedHost;
                const nodeUrl = `https://${sanitizedHost}/api/${endpoint}?vm=${hostname}`;
                if (['start', 'stop', 'reboot', 'destroy'].includes(endpoint)) await recordLog(env, `Action [${endpoint.toUpperCase()}] on node: ${hostname}`);
                const nodeResponse = await fetch(nodeUrl, { headers: { "X-API-Key": "diamon" }, signal: AbortSignal.timeout(15000) });
                return new Response(await nodeResponse.text(), { status: nodeResponse.status, headers: { "Content-Type": "application/json" } });
            } catch (error: any) { return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
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
