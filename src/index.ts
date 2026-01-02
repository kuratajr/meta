export interface Env {
    GITHUB_OWNER: string;
    GITHUB_REPO: string;
    GITHUB_BRANCH: string;
    GITHUB_TOKEN: string;
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
                "User-Agent": "Cloudflare-Worker"
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
                // 1. Fetch Global and Node JSON (Parallel)
                const [globalConfig, nodeJson] = await Promise.all([
                    fetchGithubFile('configs/global.json', env),
                    fetchGithubFile(`configs/${hostname}.json`, env)
                ]);

                if (!nodeJson) {
                    return new Response(JSON.stringify({ error: "Node config not found" }), { status: 404 });
                }

                const mergedConfig = { ...(globalConfig || {}), ...nodeJson, hostname };

                // 2. Check if Template exists
                if (mergedConfig.template) {
                    const templatePath = `templates/${mergedConfig.template}.sh`;
                    let templateContent = await fetchGithubFile(templatePath, env, false);

                    if (templateContent) {
                        // Injection Engine: replace {{VAR}} with mergedConfig[var]
                        templateContent = templateContent.replace(/{{(\w+)}}/g, (match: string, key: string) => {
                            const value = mergedConfig[key.toLowerCase()] || mergedConfig[key];
                            return value !== undefined ? value : match;
                        });

                        return new Response(templateContent, {
                            headers: {
                                "Content-Type": "text/x-shellscript",
                                "Cache-Control": "public, max-age=60"
                            }
                        });
                    }
                }

                // Fallback to JSON if no template or error
                return new Response(JSON.stringify(mergedConfig, null, 2), {
                    headers: { "Content-Type": "application/json" }
                });

            } catch (error: any) {
                return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
            }
        }

        return new Response("VPS Metadata Server - Smart Templates Ready.", { status: 200 });
    },
};
