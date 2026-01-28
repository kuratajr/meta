/**
 * File Explorer UI Component for META Dashboard
 * Ported from vnx project
 */

function isItemDirectory(item) {
    if (item.isDir === true || item.is_dir === true || item.IsDir === true) return true;
    if (item.type === 'dir' || item.type === 'directory') return true;
    return false;
}

export class FileExplorer {
    constructor(containerId) {
        const el = document.getElementById(containerId);
        if (!el) throw new Error(`Container #${containerId} not found`);
        this.container = el;
        this.fileList = [];
        this.currentPath = '/';
        this.client = null;
    }

    setClient(client) {
        this.client = client;
    }

    getCurrentPath() {
        return this.currentPath;
    }

    async loadPath(path = '/') {
        if (!this.client) return;
        this.clear();
        try {
            const resource = await this.client.listDir(path);
            this.currentPath = path;
            const entries = (resource.items || []).map(item => {
                const isDir = isItemDirectory(item);
                return {
                    name: item.name,
                    type: isDir ? 'directory' : 'file',
                    size: item.size,
                    path: (path === '/' ? '' : path) + '/' + item.name
                };
            });
            this.updateFiles(entries);

            // Dispatch event for breadcrumb or other UI updates
            const event = new CustomEvent('path-changed', { detail: { path } });
            window.dispatchEvent(event);
        } catch (err) {
            this.setError(`Error: ${err.message}`);
        }
    }

    updateFiles(files) {
        this.fileList = files;
        this.render();
    }

    clear() {
        this.container.innerHTML = `
            <div style="padding: 2rem; color: #666; display: flex; flex-direction: column; align-items: center; gap: 0.8rem;">
                <div class="loader-spinner"></div>
                <div style="font-size: 0.85rem; font-style: italic;">Loading files...</div>
            </div>
        `;
    }

    setError(msg) {
        this.container.innerHTML = `
            <div style="padding: 2rem; color: #ff7b72; display: flex; flex-direction: column; align-items: center; gap: 1rem; text-align: center;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div style="font-size: 0.9rem; font-weight: 500; line-height: 1.4;">${msg}</div>
                <button class="btn btn-s" onclick="document.getElementById('refresh-fm-btn').click()" style="margin-top: 0.5rem;">Retry</button>
            </div>
        `;
    }

    disconnect() {
        this.client = null;
        this.fileList = [];
        this.currentPath = '/';
        this.container.innerHTML = '<div class="file-list-placeholder">Disconnected. Connect to terminal to use File Manager.</div>';
    }

    render() {
        this.container.innerHTML = '';

        // Add ".." entry if not in root
        if (this.currentPath !== '/' && this.currentPath !== '') {
            const backEl = document.createElement('div');
            backEl.className = 'file-item folder';
            backEl.innerHTML = `
                ${this.getIcon('directory')}
                <span>.. (Parent Directory)</span>
            `;
            backEl.addEventListener('click', () => {
                const parts = this.currentPath.split('/').filter(Boolean);
                parts.pop();
                const parentPath = '/' + parts.join('/');
                this.loadPath(parentPath);
            });
            this.container.appendChild(backEl);
        }

        // Sort: Directories first, then files
        this.fileList.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'directory' ? -1 : 1;
        });

        if (this.fileList.length === 0 && this.currentPath === '/') {
            this.container.innerHTML = '<div style="padding:10px; color:#666; font-style:italic;">Folder is empty</div>';
            return;
        }

        this.fileList.forEach(file => {
            const el = document.createElement('div');
            el.className = `file-item ${file.type === 'directory' ? 'folder' : ''}`;
            const sizeStr = file.type === 'file' ? `<span class="file-size">${this.formatSize(file.size || 0)}</span>` : '';
            el.innerHTML = `
                ${this.getIcon(file.type)}
                <span class="file-name">${file.name}</span>
                ${sizeStr}
            `;

            el.addEventListener('click', (e) => {
                if (file.type === 'directory') {
                    this.loadPath(file.path);
                } else {
                    const event = new CustomEvent('file-selected', {
                        detail: { file, clientX: e.clientX, clientY: e.clientY }
                    });
                    window.dispatchEvent(event);
                }
            });
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const event = new CustomEvent('file-selected', {
                    detail: { file, clientX: e.clientX, clientY: e.clientY }
                });
                window.dispatchEvent(event);
            });

            this.container.appendChild(el);
        });

        // Initialize Lucide icons if available
        if (window.lucide) window.lucide.createIcons();
    }

    getIcon(type) {
        const svgClass = type === 'directory' ? 'folder-icon' : 'file-icon';
        const path = type === 'directory'
            ? `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />`
            : `<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" />`;
        return `<div class="icon-wrapper"><svg class="${svgClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg></div>`;
    }

    formatSize(n) {
        if (n === 0) return '';
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
        return (n / (1024 * 1024)).toFixed(1) + ' MB';
    }
}
