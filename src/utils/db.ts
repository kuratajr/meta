import { Env } from '../index';

export async function recordLog(env: Env, msg: string, node?: string) {
    try {
        await env.DB.prepare('INSERT INTO logs (msg, node) VALUES (?, ?)')
            .bind(msg, node || null)
            .run();
    } catch (e) {
        console.error("Failed to record log to D1:", e);
    }
}
