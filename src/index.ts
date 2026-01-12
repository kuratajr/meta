export interface Env {
    GITHUB_OWNER: string;
    GITHUB_REPO: string;
    GITHUB_BRANCH: string;
    GITHUB_TOKEN: string;
    CONFIG_KV: KVNamespace; // Binding for Cloudflare KV
    ADMIN_TOKEN?: string;   // Optional admin token for dashboard
}

import { DASHBOARD_HTML } from './dashboard';

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
            },
            cf: {
                cacheTtl: 0,
                cacheEverything: false
            }
        });

        clearTimeout(timeoutId);
        if (response.status === 404) return null;
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

        if (url.pathname === '/config' && hostname) {
            try {
                // 1. Fetch Node and Global Config from KV (Instant Updates)
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

                // 1.2 Fetch Centralized Registry
                const registryData = await env.CONFIG_KV.get('registry');
                const registryJson: Record<string, string> = registryData ? JSON.parse(registryData) : {};
                const registryConfig: Record<string, string> = {};
                for (const [key, value] of Object.entries(registryJson)) {
                    registryConfig[`host:${key}`] = value;
                }

                // 1.5 Fetch Central Group Mappings
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

                // 2. Fetch from GitHub (Node and Global)
                const [gitGlobalJson, gitNodeJson] = await Promise.all([
                    fetchGithubFile('configs/global.json', env),
                    fetchGithubFile(`configs/${hostname}.json`, env)
                ]);

                // 2.1 Determine Group
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

                // 2.2 Hierarchical Merge: Global < Group < Node < Registry
                const mergedConfig: any = {
                    ...(gitGlobalJson || {}),
                    ...(kvGlobalJson || {}),
                    ...(gitGroupJson || {}),
                    ...(kvGroupJson || {}),
                    ...nodePart,
                    ...registryConfig,
                    hostname
                };

                // 2.3 Fetch stand-alone KV keys (for placeholders not in JSON config)
                if (mergedConfig.template) {
                    const templateName = mergedConfig.template;
                    let templateContent = await env.CONFIG_KV.get(`template:${templateName}`);
                    if (!templateContent) {
                        templateContent = await fetchGithubFile(`templates/${templateName}.sh`, env, false);
                    }

                    if (templateContent) {
                        // Scan for placeholders in config values and template
                        const placeholderSet = new Set<string>();
                        const scanRegex = /{{([\w:.-]+)}}/g;
                        const scanText = (text: string) => {
                            let match;
                            while ((match = scanRegex.exec(text)) !== null) {
                                placeholderSet.add(match[1]);
                            }
                        };

                        // Scan everything to find missing keys
                        for (const key in mergedConfig) {
                            if (typeof mergedConfig[key] === 'string') scanText(mergedConfig[key]);
                        }
                        scanText(templateContent);

                        // Fetch keys that aren't in mergedConfig already
                        const keysToFetch = Array.from(placeholderSet).filter(k =>
                            mergedConfig[k] === undefined && mergedConfig[k.toLowerCase()] === undefined
                        );

                        if (keysToFetch.length > 0) {
                            const kvResults = await Promise.all(keysToFetch.map(k => env.CONFIG_KV.get(k)));
                            keysToFetch.forEach((k, i) => {
                                if (kvResults[i] !== null) mergedConfig[k] = kvResults[i];
                            });
                        }

                        // 2.5 Resolve placeholders within the configuration itself (e.g. KV values in user_data)
                        for (const key in mergedConfig) {
                            if (typeof mergedConfig[key] === 'string') {
                                mergedConfig[key] = resolvePlaceholders(mergedConfig[key], mergedConfig);
                            }
                        }

                        // 3. Process Template
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

        if (url.pathname === '/register' && request.method === 'POST') {
            try {
                const body: any = await request.json();
                const { hostname: regHostname, host: regHost } = body;

                if (!regHostname || !regHost) {
                    return new Response(JSON.stringify({ error: "Missing hostname or host" }), { status: 400 });
                }

                // Atomic update (Fetch -> Modify -> Save)
                const registryData = await env.CONFIG_KV.get('registry');
                const registryJson = registryData ? JSON.parse(registryData) : {};
                registryJson[regHostname] = regHost;

                await env.CONFIG_KV.put('registry', JSON.stringify(registryJson));

                return new Response(JSON.stringify({ success: true, message: `Registered ${regHostname}` }), {
                    headers: { "Content-Type": "application/json" }
                });
            } catch (error: any) {
                return new Response(JSON.stringify({ error: "Failed to register node" }), { status: 500 });
            }
        }

        if (url.pathname === '/' && request.method === 'GET') {
            return new Response(DASHBOARD_HTML, {
                headers: { "Content-Type": "text/html" }
            });
        }

        // --- DASHBOARD API ---
        const authHeader = request.headers.get('Authorization');
        const queryToken = url.searchParams.get('token');
        const isAuthorized = (env.ADMIN_TOKEN && (authHeader === env.ADMIN_TOKEN || queryToken === env.ADMIN_TOKEN));

        if (url.pathname.startsWith('/api/') && !isAuthorized) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        if (url.pathname === '/api/data' && request.method === 'GET') {
            const [registryData, groupsMappingData, allKeys] = await Promise.all([
                env.CONFIG_KV.get('registry'),
                env.CONFIG_KV.get('groups'),
                env.CONFIG_KV.list()
            ]);

            const keys = allKeys.keys.map((k: { name: string }) => k.name);
            const templates = keys.filter((k: string) => k.startsWith('template:'));
            const groupConfigs = keys.filter((k: string) => k.startsWith('group:'));
            const nodeConfigs = keys.filter((k: string) => k.startsWith('node:'));

            return new Response(JSON.stringify({
                registry: registryData ? JSON.parse(registryData) : {},
                groups: groupsMappingData ? JSON.parse(groupsMappingData) : [],
                templates,
                groupConfigs,
                nodeConfigs
            }), { headers: { "Content-Type": "application/json" } });
        }

        if (url.pathname === '/api/get-kv' && request.method === 'GET') {
            const key = url.searchParams.get('key');
            if (!key) return new Response("Key required", { status: 400 });
            const val = await env.CONFIG_KV.get(key);
            return new Response(val || "");
        }

        if (url.pathname === '/api/save' && request.method === 'POST') {
            const { key, value } = await request.json() as any;
            if (!key) return new Response("Key required", { status: 400 });
            await env.CONFIG_KV.put(key, value);
            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response("VPS Metadata Server - Dashboard Ready.", { status: 200 });
    },
};
