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

                // Priority: KV Node > Git Node > KV Global > Git Global
                const mergedConfig = {
                    ...(gitGlobalJson || {}),
                    ...(kvGlobalJson || {}),
                    ...(gitNodeJson || {}),
                    ...(kvNodeJson || {}),
                    hostname
                };

                if (Object.keys(mergedConfig).length <= 1) {
                    return new Response(JSON.stringify({ error: "No configuration found" }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                // 3. Process Template
                if (mergedConfig.template) {
                    const templateName = mergedConfig.template;

                    // Check KV for template first
                    let templateContent = await env.CONFIG_KV.get(`template:${templateName}`);

                    // If not in KV, fallback to GitHub
                    if (!templateContent) {
                        templateContent = await fetchGithubFile(`templates/${templateName}.sh`, env, false);
                    }

                    if (templateContent) {
                        templateContent = templateContent.replace(/{{(\w+)}}/g, (match: string, key: string) => {
                            const value = mergedConfig[key.toLowerCase()] || mergedConfig[key];
                            return value !== undefined ? value : match;
                        });

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
