export interface Env {
    GITHUB_OWNER: string;
    GITHUB_REPO: string;
    GITHUB_BRANCH: string;
    GITHUB_TOKEN: string;
    CONFIG_KV: KVNamespace; // Binding for Cloudflare KV
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

                // 2. Fetch from GitHub (Only if not fully covered by KV, or always for base Global)
                const githubTasks: Promise<any>[] = [fetchGithubFile('configs/global.json', env)];
                if (!kvNodeJson) {
                    githubTasks.push(fetchGithubFile(`configs/${hostname}.json`, env));
                }

                const [gitGlobalJson, gitNodeJson] = await Promise.all(githubTasks);

                const mergedConfig: any = {
                    ...(gitGlobalJson || {}),
                    ...(kvGlobalJson || {}),
                    ...(gitNodeJson || {}),
                    ...(kvNodeJson || {}),
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

        return new Response("VPS Metadata Server - Hybrid Mode Ready.", { status: 200 });
    },
};
