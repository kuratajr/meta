/// <reference types="@cloudflare/workers-types" />

export interface Env {
    GITHUB_OWNER: string;
    GITHUB_REPO: string;
    GITHUB_BRANCH: string;
    GITHUB_TOKEN: string;
    CONFIG_KV: KVNamespace;
    DB: D1Database;
    ADMIN_TOKEN?: string;
}

import { handleRequest } from './api/router';

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        return handleRequest(request, env, ctx);
    },
};
