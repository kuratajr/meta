/**
 * FileBrowser API Client for META Dashboard
 * Adapted from vnx project
 */

function trimSlash(s) {
    return s.replace(/\/+$/, '');
}

function buildResourcePath(path) {
    if (path === '' || path === '/') return '/';
    const segments = path.replace(/^\//, '').split('/').filter(Boolean);
    const p = segments.map(encodeURIComponent).join('/');
    return p ? `/${p}` : '/';
}

export class FileBrowserClient {
    constructor(baseUrl, token, hostname) {
        this.baseUrl = trimSlash(baseUrl); // This will be /terminal-proxy/${token}/${hostname}
        this.token = ''; // FileBrowser JWT token (internal to FB)
    }

    /** Set internal FileBrowser token */
    setToken(token) {
        this.token = token;
    }

    getToken() {
        return this.token;
    }

    async request(method, path, options = {}) {
        // Fix: Properly construct the URL to include the proxy prefix
        const base = trimSlash(this.baseUrl);
        const relative = path.startsWith('/') ? path : `/${path}`;
        const url = new URL(window.location.origin + base + relative);

        if (options.searchParams) {
            Object.entries(options.searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
        }

        const headers = {
            ...(options.headers || {}),
        };

        if (this.token) {
            headers['X-Auth'] = this.token;
        }

        if (options.body !== undefined && typeof options.body === 'string' && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        const fetchOptions = {
            method,
            headers,
            body: options.body,
        };

        const res = await fetch(url.toString(), fetchOptions);

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`FileBrowser API Error: ${res.status} ${res.statusText}\n${text}`);
        }

        const contentType = res.headers.get('Content-Type');
        if (contentType && contentType.includes('application/json')) {
            return await res.json();
        }
        return await res.text();
    }

    async login(username, password) {
        const base = trimSlash(this.baseUrl);
        const res = await fetch(`${base}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const text = await res.text();
        if (!res.ok) {
            throw new Error(`Login failed: ${res.status} ${res.statusText}`);
        }

        // Support both plain text tokens and JSON responses like {"token": "..."}
        try {
            const json = JSON.parse(text);
            if (json.token) {
                this.token = json.token;
                return json.token;
            }
        } catch (e) { }

        this.token = text.trim();
        return this.token;
    }

    async getResource(path, opts = {}) {
        const rp = buildResourcePath(path);
        const searchParams = {};
        if (opts.checksum) searchParams.checksum = opts.checksum;
        return this.request('GET', `/api/resources${rp}`, { searchParams });
    }

    async listDir(path) {
        return this.getResource(path);
    }

    async createDir(path) {
        const normalized = trimSlash(path);
        const rp = buildResourcePath(normalized);
        const resourcePath = normalized ? `${rp}/` : '/';
        await this.request('POST', `/api/resources${resourcePath}`);
    }

    async upload(path, content, options = {}) {
        const rp = buildResourcePath(path);
        const searchParams = options.override ? { override: 'true' } : {};
        await this.request('POST', `/api/resources${rp}`, {
            body: content,
            searchParams,
            headers: typeof content === 'string' ? { 'Content-Type': 'application/octet-stream' } : undefined
        });
    }

    async delete(path) {
        const rp = buildResourcePath(path);
        await this.request('DELETE', `/api/resources${rp}`);
    }

    async patch(path, options) {
        const rp = buildResourcePath(path);
        const searchParams = {
            action: options.action,
            destination: options.destination,
        };
        if (options.override) searchParams.override = 'true';
        if (options.rename) searchParams.rename = 'true';
        await this.request('PATCH', `/api/resources${rp}`, { searchParams });
    }

    async copy(src, dest, override) {
        await this.patch(src, { action: 'copy', destination: dest, override });
    }

    async rename(src, dest, options = {}) {
        await this.patch(src, {
            action: 'rename',
            destination: dest,
            override: options.override,
            rename: options.rename,
        });
    }

    async getRawBuffer(path) {
        const rp = buildResourcePath(path);
        const url = `${this.baseUrl}/api/raw${rp}`;
        const headers = {};
        if (this.token) headers['X-Auth'] = this.token;
        const res = await fetch(url, { method: 'GET', headers });
        if (!res.ok) throw new Error('Failed to fetch raw file');
        return await res.arrayBuffer();
    }
}
