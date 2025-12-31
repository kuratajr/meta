export interface Env {
    GITHUB_OWNER: string;
    GITHUB_REPO: string;
    GITHUB_BRANCH: string;
    GITHUB_TOKEN: string;
}

async function fetchGithubFile(path: string, env: Env): Promise<any | null> {
    const url = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH}/${path}`;

    // Create a timeout controller to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout

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

        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        console.error(`Error fetching ${path}:`, error);
        return null;
    }
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/config') {
            const hostname = url.searchParams.get('hostname');

            if (!hostname) {
                return new Response(JSON.stringify({ error: "Hostname is required" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
            }

            try {
                // Run both fetches in parallel to maximize speed
                const [globalConfig, nodeConfig] = await Promise.all([
                    fetchGithubFile('configs/global.json', env),
                    fetchGithubFile(`configs/${hostname}.json`, env)
                ]);

                // Merge Configs
                const finalConfig = {
                    ...(globalConfig || {}),
                    ...(nodeConfig || {}),
                    hostname: hostname
                };

                return new Response(JSON.stringify(finalConfig, null, 2), {
                    headers: {
                        "Content-Type": "application/json",
                        "Cache-Control": "public, max-age=60" // Cache for 1 minute at the edge
                    }
                });
            } catch (error: any) {
                return new Response(JSON.stringify({ error: "Internal Server Error" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        return new Response("VPS Metadata Server (Optimized).", { status: 200 });
    },
};
