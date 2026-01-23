/// <reference types="@cloudflare/workers-types" />
import { Env } from '../index';
import { DASHBOARD_HTML } from '../dashboard';
import { recordLog } from '../utils/db';
import { fetchGithubFile } from '../utils/github';
import { resolvePlaceholders } from '../utils/config';

export async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.searchParams.get('hostname');

    // 1. Config endpoint
    if (url.pathname === '/config' && hostname) {
        return handleConfigEndpoint(hostname, request, env);
    }

    // 2. Register endpoint
    if (url.pathname === '/register' && request.method === 'POST') {
        return handleRegisterEndpoint(request, env);
    }

    // 3. Root Dashboard
    if (url.pathname === '/' && request.method === 'GET') {
        return new Response(DASHBOARD_HTML, {
            headers: { "Content-Type": "text/html" }
        });
    }

    // --- AUTH CHECK ---
    const authHeader = request.headers.get('Authorization');
    const queryToken = url.searchParams.get('token');
    const isAuthorized = (env.ADMIN_TOKEN && (authHeader === env.ADMIN_TOKEN || queryToken === env.ADMIN_TOKEN));

    // 4. Terminal Proxy (requires token in path)
    if (url.pathname.startsWith('/terminal-proxy/')) {
        return handleTerminalProxy(url, request, env);
    }

    // API checks
    if (url.pathname.startsWith('/api/') && !isAuthorized) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // 5. API Data
    if (url.pathname === '/api/data' && request.method === 'GET') {
        return handleApiData(env);
    }

    // 6. API Logs
    if (url.pathname === '/api/logs' && request.method === 'GET') {
        return handleApiLogs(url, env);
    }

    // 7. API Record Log
    if (url.pathname === '/api/record-log' && request.method === 'POST') {
        const { msg, node } = await request.json() as any;
        if (msg) await recordLog(env, msg, node);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    // 8. API Get KV
    if (url.pathname === '/api/get-kv' && request.method === 'GET') {
        const key = url.searchParams.get('key');
        if (!key) return new Response("Key required", { status: 400 });
        const val = await env.CONFIG_KV.get(key);
        return new Response(val || "");
    }

    // 9. API Save
    if (url.pathname === '/api/save' && request.method === 'POST') {
        const { key, value } = await request.json() as any;
        if (!key) return new Response("Key required", { status: 400 });
        await env.CONFIG_KV.put(key, value);
        const nodeMatch = key.match(/^node:(.+)$/);
        await recordLog(env, `Updated config: ${key}`, nodeMatch ? nodeMatch[1] : undefined);
        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    // 10. API Delete
    if (url.pathname === '/api/delete' && request.method === 'POST') {
        const { key } = await request.json() as any;
        if (!key) return new Response("Key required", { status: 400 });
        await env.CONFIG_KV.delete(key);
        const nodeMatch = key.match(/^node:(.+)$/);
        await recordLog(env, `Deleted config: ${key}`, nodeMatch ? nodeMatch[1] : undefined);
        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    // 11. API Node Proxy
    if (url.pathname === '/api/node-proxy' && request.method === 'GET') {
        return handleNodeProxy(url, env);
    }

    // 12. Batch Check Nodes
    if (url.pathname === '/api/batch-check-nodes' && request.method === 'GET') {
        return handleBatchCheck(url, env);
    }

    return new Response("VPS Metadata Server - Dashboard Ready.", { status: 200 });
}

async function handleConfigEndpoint(hostname: string, request: Request, env: Env) {
    try {
        const [kvNodeData, kvGlobalData] = await Promise.all([
            env.CONFIG_KV.get(`node:${hostname}`),
            env.CONFIG_KV.get('global')
        ]);

        let kvNodeJson: any = null;
        let kvGlobalJson: any = null;

        if (kvNodeData) {
            try { kvNodeJson = JSON.parse(kvNodeData); } catch (e) { }
        }
        if (kvGlobalData) {
            try { kvGlobalJson = JSON.parse(kvGlobalData); } catch (e) { }
        }

        const registryData = await env.CONFIG_KV.get('registry');
        const registryJson: Record<string, string> = registryData ? JSON.parse(registryData) : {};
        const registryConfig: Record<string, string> = {};
        for (const [key, value] of Object.entries(registryJson)) {
            registryConfig[`host:${key}`] = value;
        }

        const ipsData = await env.CONFIG_KV.get('ips');
        const ipsJson: Record<string, string> = ipsData ? JSON.parse(ipsData) : {};
        const ipConfig: Record<string, string> = {};
        if (ipsJson[hostname]) {
            ipConfig['IP'] = ipsJson[hostname];
        }
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

        const nodePart: any = {
            ...(gitNodeJson || {}),
            ...(kvNodeJson || {})
        };
        const groupName = nodePart.group || nodePart.GROUP || centralGroupName;

        let gitGroupJson: any = null;
        let kvGroupJson: any = null;

        if (groupName) {
            const [kvGroupData, gitGroupData] = await Promise.all([
                env.CONFIG_KV.get(`group:${groupName}`),
                fetchGithubFile(`configs/groups/${groupName}.json`, env)
            ]);
            if (kvGroupData) {
                try { kvGroupJson = JSON.parse(kvGroupData); } catch (e) { }
            }
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
            ADMIN_TOKEN: (env as any).ADMIN_TOKEN || ""
        };

        if (mergedConfig.template) {
            const templateName = mergedConfig.template;
            let templateContent = await env.CONFIG_KV.get(`template:${templateName}`);
            if (!templateContent) {
                templateContent = await fetchGithubFile(`templates/${templateName}.sh`, env, false);
            }

            if (templateContent) {
                const placeholderSet = new Set<string>();
                const scanRegex = /{{([\w:.-]+)}}/g;
                const scanText = (text: string) => {
                    let match;
                    while ((match = scanRegex.exec(text)) !== null) {
                        placeholderSet.add(match[1]);
                    }
                };

                for (const key in mergedConfig) {
                    if (typeof mergedConfig[key] === 'string') scanText(mergedConfig[key]);
                }
                scanText(templateContent);

                const keysToFetch = Array.from(placeholderSet).filter(k =>
                    mergedConfig[k] === undefined && mergedConfig[k.toLowerCase()] === undefined
                );

                if (keysToFetch.length > 0) {
                    const kvResults = await Promise.all(keysToFetch.map(k => env.CONFIG_KV.get(k)));
                    keysToFetch.forEach((k, i) => {
                        if (kvResults[i] !== null) mergedConfig[k] = kvResults[i];
                    });
                }

                for (const key in mergedConfig) {
                    if (typeof mergedConfig[key] === 'string') {
                        mergedConfig[key] = resolvePlaceholders(mergedConfig[key], mergedConfig);
                    }
                }

                templateContent = resolvePlaceholders(templateContent, mergedConfig);

                return new Response(templateContent, {
                    headers: {
                        "Content-Type": "text/x-shellscript",
                        "Cache-Control": "no-store, no-cache, must-revalidate",
                        "Pragma": "no-cache",
                        "Expires": "0"
                    }
                });
            }
        }

        return new Response(JSON.stringify(mergedConfig, null, 2), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store, no-cache, must-revalidate"
            }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}

async function handleRegisterEndpoint(request: Request, env: Env) {
    try {
        const body: any = await request.json();
        const { hostname: regHostname, host: regHost } = body;

        if (!regHostname || !regHost) {
            return new Response(JSON.stringify({ error: "Missing hostname or host" }), { status: 400 });
        }

        const registryData = await env.CONFIG_KV.get('registry');
        const registryJson = registryData ? JSON.parse(registryData) : {};
        registryJson[regHostname] = regHost;

        await env.CONFIG_KV.put('registry', JSON.stringify(registryJson));
        await recordLog(env, `New node registered: ${regHostname}`, regHostname);

        return new Response(JSON.stringify({ success: true, message: `Registered ${regHostname}` }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: "Failed to register node" }), { status: 500 });
    }
}

async function handleTerminalProxy(url: URL, request: Request, env: Env) {
    const parts = url.pathname.split('/');
    const requestToken = parts[2];
    const nodeHostname = parts[3];
    const remainingPath = parts.slice(4).join('/') + url.search;

    const isReqAuthorized = (env.ADMIN_TOKEN && requestToken === env.ADMIN_TOKEN);
    if (!isReqAuthorized) return new Response("Unauthorized", { status: 401 });

    const registryData = await env.CONFIG_KV.get('registry');
    const registry = registryData ? JSON.parse(registryData) : {};
    const host = registry[nodeHostname];
    if (!host) return new Response("Node not found", { status: 404 });

    const targetUrl = `https://8877-${host}/${remainingPath}`;
    const targetHost = `8877-${host}`;

    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
        const proxyHeaders = new Headers(request.headers);
        proxyHeaders.set('Host', targetHost);
        proxyHeaders.set('Origin', `https://${targetHost}`);
        const protocol = request.headers.get('Sec-WebSocket-Protocol') || 'tty';
        proxyHeaders.set('Sec-WebSocket-Protocol', protocol);

        return fetch(targetUrl, {
            headers: proxyHeaders,
            redirect: 'follow'
        });
    }

    const headers = new Headers(request.headers);
    headers.set('Host', targetHost);
    headers.set('Origin', `https://${targetHost}`);
    const response = await fetch(targetUrl, { headers, redirect: 'follow' });
    const newHeaders = new Headers(response.headers);
    newHeaders.delete('Content-Security-Policy');
    newHeaders.delete('X-Frame-Options');
    newHeaders.set('Access-Control-Allow-Origin', '*');
    return new Response(response.body, { status: response.status, headers: newHeaders });
}

async function handleApiData(env: Env) {
    const [registryData, groupsMappingData, allKeys] = await Promise.all([
        env.CONFIG_KV.get('registry'),
        env.CONFIG_KV.get('groups'),
        env.CONFIG_KV.list()
    ]);

    const keys = allKeys.keys.map((k: { name: string }) => k.name);
    const templates = keys.filter((k: string) => k.startsWith('template:'));
    const groupConfigs = keys.filter((k: string) => k.startsWith('group:'));
    const nodeConfigs = keys.filter((k: string) => k.startsWith('node:'));
    const certConfigs = keys.filter((k: string) => k.startsWith('cert:'));
    const cloudConfigs = keys.filter((k: string) => k.startsWith('cloud:'));
    const [ipsData, hasGlobal] = await Promise.all([
        env.CONFIG_KV.get('ips'),
        Promise.resolve(keys.includes('global'))
    ]);

    return new Response(JSON.stringify({
        registry: registryData ? JSON.parse(registryData) : {},
        groups: groupsMappingData ? JSON.parse(groupsMappingData) : [],
        templates,
        groupConfigs,
        nodeConfigs,
        certConfigs,
        cloudConfigs,
        ips: ipsData ? JSON.parse(ipsData) : {},
        hasGlobal
    }), { headers: { "Content-Type": "application/json" } });
}

async function handleApiLogs(url: URL, env: Env) {
    const nodeFilter = url.searchParams.get('hostname');
    const dateFilter = url.searchParams.get('date');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    try {
        let query = 'SELECT * FROM logs';
        let params: any[] = [];
        let conditions: string[] = [];

        if (nodeFilter) {
            conditions.push('(node = ? OR msg LIKE ?)');
            params.push(nodeFilter, `%${nodeFilter}%`);
        }

        if (dateFilter) {
            conditions.push("time < DATE(?, '+1 day')");
            params.push(dateFilter);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const { results } = await env.DB.prepare(query).bind(...params).all();
        return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    } catch (e: any) {
        console.error("D1 Query Error:", e.message);
        return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
    }
}

async function handleNodeProxy(url: URL, env: Env) {
    const hostname = url.searchParams.get('hostname');
    const endpoint = url.searchParams.get('endpoint');

    if (!hostname || !endpoint) {
        return new Response(JSON.stringify({ error: "Hostname and endpoint required" }), { status: 400 });
    }

    const registryData = await env.CONFIG_KV.get('registry');
    const registry = registryData ? JSON.parse(registryData) : {};
    const host = registry[hostname];

    if (!host) {
        return new Response(JSON.stringify({ error: "Node not found in registry" }), { status: 404 });
    }

    try {
        let sanitizedHost = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        if (!sanitizedHost.startsWith('31465-')) sanitizedHost = '31465-' + sanitizedHost;

        const nodeUrl = `https://${sanitizedHost}/api/${endpoint}?vm=${hostname}`;

        if (['start', 'stop', 'reboot', 'destroy'].includes(endpoint)) {
            await recordLog(env, `Action [${endpoint.toUpperCase()}] on node: ${hostname}`);
        }

        const nodeResponse = await fetch(nodeUrl, {
            headers: { "X-API-Key": "diamon" },
            signal: AbortSignal.timeout(15000)
        });
        const data = await nodeResponse.text();
        return new Response(data, {
            status: nodeResponse.status,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: `Failed to connect to node: ${error.message}` }), { status: 500 });
    }
}

async function handleBatchCheck(url: URL, env: Env) {
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const registryData = await env.CONFIG_KV.get('registry');
    const registry = registryData ? JSON.parse(registryData) : {};
    const allHostnames = Object.keys(registry);
    const hostnames = allHostnames.slice(offset, offset + limit);

    const statusMap: Record<string, boolean> = {};
    await Promise.all(hostnames.map(async (h) => {
        const host = registry[h];
        if (!host) { statusMap[h] = false; return; }
        try {
            let sanitizedHost = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
            if (!sanitizedHost.startsWith('8080-')) sanitizedHost = '8080-' + sanitizedHost;

            const nodeUrl = `https://${sanitizedHost}`;
            const resp = await fetch(nodeUrl, {
                method: 'GET',
                headers: { "X-API-Key": "diamon" },
                signal: AbortSignal.timeout(10000),
                redirect: 'manual'
            });
            statusMap[h] = resp.status !== 404;
        } catch (e) {
            statusMap[h] = false;
        }
    }));

    return new Response(JSON.stringify(statusMap), {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    });
}
