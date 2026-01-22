export const GLOBALS_JS = `// @ts-nocheck
if (typeof window !== 'undefined') {
    window.TOKEN = new URLSearchParams(window.location.search).get('token');
    window.currentKey = '';
    window.isNew = false;
    window.groupsData = [];
    window.lastData = null;
    window.currentSearch = '';
    window.previousStatuses = {};
    window.currentStatusFilter = 'all';

    // Log states for pagination
    window.logState = {
        system: { offset: 0, date: new Date().toLocaleDateString('en-CA'), hostname: '', loading: false, hasMore: true, lastDateStr: '' },
        live: { offset: 0, date: '', hostname: '', loading: false, hasMore: true, lastDateStr: '' }
    };
}`;

export const UI_JS = `// @ts-nocheck
if (typeof window !== 'undefined') {
    window.toggleSidebar = function() {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('overlay').classList.toggle('show');
    };

    window.showSection = function(id) {
        if (window.innerWidth <= 1024) {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('overlay').classList.remove('show');
        }
        
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        
        const target = document.getElementById('section-' + id);
        if (target) target.classList.add('active');
        
        document.getElementById('nav-' + id)?.classList.add('active');

        let sectionTitle = id.charAt(0).toUpperCase() + id.slice(1);
        if (id === 'ips') sectionTitle = 'IP Management';
        else if (id === 'cloud') sectionTitle = 'Cloud-init Meta';
        else if (id === 'global') sectionTitle = 'Global & Security';
        else if (id === 'logs') { sectionTitle = 'Logs & Activity'; window.refreshLogs(); }
        
        document.getElementById('page-title').innerText = sectionTitle;
        
        const nodesSearchBox = document.getElementById('nodes-search-box');
        if (nodesSearchBox) {
            nodesSearchBox.className = (['nodes', 'groups', 'configs', 'templates'].includes(id)) ? 'search-container show' : 'search-container';
        }
    };

    window.toggleDropdown = function(event) {
        event.stopPropagation();
        const content = event.currentTarget.nextElementSibling;
        const isShow = content.classList.contains('show');
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
        if (!isShow) content.classList.add('show');
    };

    window.onclick = function (event) {
        if (!event.target.matches('.dropdown-trigger') && !event.target.closest('.dropdown-trigger')) {
            document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
        }
    };
}`;

export const DATA_JS = `// @ts-nocheck
if (typeof window !== 'undefined') {
    window.refreshData = async function() {
        if (!window.TOKEN) { document.getElementById('auth-warning').style.display = 'block'; return; }
        document.getElementById('loader').style.display = 'block';
        try {
            const res = await fetch(\`/api/data?token=\${window.TOKEN}\`);
            const data = await res.json();
            window.lastData = data;
            window.renderUI(data);
            if (window.lucide) lucide.createIcons();
        } catch (e) {
            console.error(e);
        }
        document.getElementById('loader').style.display = 'none';
    };

    window.handleSearch = function(event) {
        window.currentSearch = event.target.value.toLowerCase();
        if (!window.lastData) return;
        window.renderUI(window.lastData);
    };

    window.renderUI = function(data) {
        window.groupsData = data.groups || [];
        document.getElementById('stat-total-nodes').innerText = Object.keys(data.registry).length;
        document.getElementById('stat-active-groups').innerText = window.groupsData.length;
        document.getElementById('stat-total-kv').innerText = (data.templates.length + data.groupConfigs.length + data.nodeConfigs.length + data.certConfigs.length + (data.hasGlobal ? 1 : 0));

        window.renderNodes(data);
        window.renderGroups(data);
        window.renderTemplates(data);
        window.renderConfigs(data);
    };

    const getGroupOf = (node) => {
        const g = window.groupsData.find(g => (g.listnode || "").split(',').map(s=>s.trim()).includes(node));
        return g ? g.config : "None";
    };

    window.renderNodes = function(data) {
        const nBody = document.getElementById('nodes-table-body');
        let html = '';
        for (const h in data.registry) {
            const regVal = data.registry[h];
            const currentGroup = getGroupOf(h);
            if (window.currentSearch && !h.toLowerCase().includes(window.currentSearch) && !regVal.toLowerCase().includes(window.currentSearch) && !currentGroup.toLowerCase().includes(window.currentSearch)) continue;

            let groupOptions = '<option value="">None</option>';
            window.groupsData.forEach(g => { groupOptions += \`<option value="\${g.config}" \${g.config === currentGroup ? 'selected' : ''}>\${g.config}</option>\`; });

            html += \`<tr data-status="\${window.previousStatuses[h] === true ? 'online' : (window.previousStatuses[h] === false ? 'offline' : '')}">
                <td style="font-weight:600;"><span class="status-dot" data-node="\${h}"></span>\${h}</td>
                <td class="copyable" onclick="copyToClipboard('\${regVal}')">\${regVal}</td>
                <td><select onchange="updateNodeGroup('\${h}', this.value)">\${groupOptions}</select></td>
                <td>
                    <div class="action-flex">
                        <button class="btn btn-s" onclick="editKV('node:\${h}')"><i data-lucide="settings"></i>Config</button>
                        <button class="btn btn-p" onclick="runNodeAction('\${h}', 'start')"><i data-lucide="play"></i>Start</button>
                        <div class="dropdown">
                            <button class="btn btn-s dropdown-trigger" onclick="toggleDropdown(event)">More</button>
                            <div class="dropdown-content">
                                <div class="dropdown-item" onclick="openTerminal('\${h}', '\${regVal}')"><i data-lucide="terminal"></i>Terminal</div>
                                <div class="dropdown-item" onclick="fetchNodeInfo('\${h}')"><i data-lucide="info"></i>Info</div>
                                <div class="dropdown-item" onclick="viewNodeLogs('\${h}')"><i data-lucide="align-left"></i>Logs</div>
                                <div class="dropdown-item" onclick="runNodeAction('\${h}', 'stop')"><i data-lucide="square"></i>Stop</div>
                                <div class="dropdown-item" onclick="runNodeAction('\${h}', 'reboot')"><i data-lucide="refresh-cw"></i>Reboot</div>
                                <div class="dropdown-divider"></div>
                                <div class="dropdown-item" style="color:var(--danger);" onclick="deleteFromRegistry('\${h}')"><i data-lucide="trash-2"></i>Delete Registry</div>
                                <div class="dropdown-item" style="color:var(--danger);" onclick="runNodeAction('\${h}', 'destroy')"><i data-lucide="zap"></i>Destroy VPS</div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>\`;
        }
        nBody.innerHTML = html || '<tr><td colspan="4" style="text-align:center; padding:3rem;">No nodes found.</td></tr>';
        window.refreshStatusDots();
    };

    window.renderGroups = function(data) {
        const gBody = document.getElementById('groups-table-body');
        if (!gBody) return;
        gBody.innerHTML = (data.groups || []).filter(g => !window.currentSearch || g.config.toLowerCase().includes(window.currentSearch)).map(g => \`<tr>
            <td style="font-weight:600;">\${g.config}</td>
            <td>\${(g.listnode || '').split(',').filter(s=>s.trim()).length} Nodes</td>
            <td><span class="badge badge-accent">Synchronized</span></td>
            <td>
                <div class="action-flex">
                    <button class="btn btn-s" onclick="editKV('group:\${g.config}')"><i data-lucide="edit-3"></i>Edit Mapping</button>
                    <button class="btn btn-danger" onclick="deleteKV('group:\${g.config}')"><i data-lucide="trash"></i>Delete</button>
                </div>
            </td>
        </tr>\`).join('') || '<tr><td colspan="4" style="text-align:center; padding:3rem;">No groups defined.</td></tr>';
    };

    window.renderTemplates = function(data) {
        const tBody = document.getElementById('templates-table-body');
        if (!tBody) return;
        tBody.innerHTML = data.templates.filter(t => !window.currentSearch || t.toLowerCase().includes(window.currentSearch)).map(t => \`<tr>
            <td style="font-weight:600;">\${t.replace('template:', '')}</td>
            <td><span class="badge badge-accent">Shell Script</span></td>
            <td>Recently</td>
            <td>
                <div class="action-flex">
                    <button class="btn btn-s" onclick="editKV('\${t}')"><i data-lucide="edit-3"></i>Edit Content</button>
                    <button class="btn btn-danger" onclick="deleteKV('\${t}')"><i data-lucide="trash"></i>Delete</button>
                </div>
            </td>
        </tr>\`).join('') || '<tr><td colspan="4" style="text-align:center; padding:3rem;">No templates found.</td></tr>';
    };

    window.renderConfigs = function(data) {
        const cBody = document.getElementById('configs-table-body');
        if (!cBody) return;
        const allConfigs = [...data.groupConfigs, ...data.nodeConfigs, ...data.certConfigs];
        cBody.innerHTML = allConfigs.filter(c => !window.currentSearch || c.toLowerCase().includes(window.currentSearch)).map(c => \`<tr>
            <td style="font-weight:600;">\${c}</td>
            <td>\${c.startsWith('group:') ? 'Group' : (c.startsWith('node:') ? 'Node' : 'Cert')}</td>
            <td>JSON</td>
            <td>
                <div class="action-flex">
                    <button class="btn btn-s" onclick="editKV('\${c}')"><i data-lucide="edit-3"></i>Edit JSON</button>
                    <button class="btn btn-danger" onclick="deleteKV('\${c}')"><i data-lucide="trash"></i>Delete</button>
                </div>
            </td>
        </tr>\`).join('') || '<tr><td colspan="4" style="text-align:center; padding:3rem;">No KV configs found.</td></tr>';
    };

    window.refreshStatusDots = async function() {
        if (!window.lastData || !window.lastData.registry) return;
        const hostnames = Object.keys(window.lastData.registry);
        const batchSize = 40;
        const total = hostnames.length;
        const promises = [];
        for (let i = 0; i < total; i += batchSize) {
            promises.push(fetch(\`/api/batch-check-nodes?token=\${window.TOKEN}&offset=\${i}&limit=\${batchSize}&_=\${Date.now()}\`).then(r => r.json()).catch(() => ({})));
        }
        try {
            const results = await Promise.all(promises);
            const allStatuses = Object.assign({}, ...results);
            for (const node of hostnames) {
                const newStatus = allStatuses[node];
                const prevStatus = window.previousStatuses[node];
                if (prevStatus !== undefined && newStatus !== prevStatus) {
                    const msg = \`Node [\${node}] is now \${newStatus ? 'ONLINE' : 'OFFLINE'}\`;
                    fetch(\`/api/record-log?token=\${window.TOKEN}\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msg, node }) }).catch(() => {});
                }
                window.previousStatuses[node] = newStatus;
            }
            document.querySelectorAll('.status-dot').forEach(dot => {
                const node = dot.getAttribute('data-node');
                const row = dot.closest('tr');
                if (allStatuses[node] === true) { dot.className = 'status-dot online'; if (row) row.setAttribute('data-status', 'online'); }
                else if (allStatuses[node] === false) { dot.className = 'status-dot offline'; if (row) row.setAttribute('data-status', 'offline'); }
            });
        } catch (e) { }
    };
}`;

export const TERMINAL_JS = `// @ts-nocheck
if (typeof window !== 'undefined') {
    window.xterm = null;
    window.xtermFit = null;
    window.termWs = null;
    window.currentTerminalNode = '';
    window.currentTerminalUrl = '';

    window.updateUIStatus = function(newStatus) {
        const wrapper = document.getElementById('terminal-wrapper');
        const statusBadge = document.getElementById('status-badge');
        const statusText = document.getElementById('status-text');
        if (!wrapper || !statusBadge || !statusText) return;
        wrapper.className = 'terminal-outer-wrapper ' + newStatus;
        statusBadge.className = 'status-badge ' + newStatus;
        switch (newStatus) {
            case 'connecting': statusText.innerText = 'Đang kết nối...'; break;
            case 'online': statusText.innerText = 'Trực tuyến'; break;
            case 'offline': statusText.innerText = 'Đã ngắt kết nối'; break;
            case 'error': statusText.innerText = 'Lỗi kết nối'; break;
        }
    };

    window.openTerminal = function(h, hostUrl) {
        window.currentTerminalNode = h;
        window.currentTerminalUrl = hostUrl;
        window.showSection('terminal');
        const terminalTitle = document.getElementById('terminal-section-title');
        terminalTitle.innerText = h;
        const originUrl = hostUrl.startsWith('http') ? hostUrl : "https://8877-" + hostUrl;
        const newTabBtn = document.getElementById('terminal-new-tab-btn');
        if (newTabBtn) newTabBtn.dataset.url = originUrl;
        window.updateUIStatus('connecting');
        window.initXterm(h);
    };

    window.initXterm = function(h) {
        if (window.termWs) { try { window.termWs.close(); } catch(e){} }
        window.termWs = null;
        const container = document.getElementById('xterm-container');
        container.innerHTML = '';
        window.xterm = new Terminal({
            cursorBlink: true, cursorStyle: 'bar', fontFamily: '"Ubuntu Mono", monospace', fontSize: 14, letterSpacing: 0.5,
            theme: {
                background: 'rgba(0, 0, 0, 0)', foreground: '#e6edf3', cursor: '#58a6ff', selection: 'rgba(88, 166, 255, 0.3)',
                black: '#484f58', red: '#ff7b72', green: '#3fb950', yellow: '#d29922', blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#b1bac4',
                brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364', brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff', brightCyan: '#56d4dd', brightWhite: '#ffffff',
            },
            allowTransparency: true, cols: 100, rows: 30
        });
        window.xtermFit = new FitAddon.FitAddon();
        window.xterm.loadAddon(window.xtermFit);
        window.xterm.open(container);
        setTimeout(() => { try { window.xtermFit.fit(); window.connectWs(h); } catch (e) { window.connectWs(h); } }, 150);
    };

    window.connectWs = function(h) {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = protocol + "//" + location.host + "/terminal-proxy/" + window.TOKEN + "/" + h + "/ws";
        window.termWs = new WebSocket(wsUrl, 'tty');
        window.termWs.binaryType = 'arraybuffer';
        const decoder = new TextDecoder();
        window.termWs.onopen = () => {
            window.updateUIStatus('online');
            window.xterm.write('\\\\x1b[38;5;82m[Hệ thống] Kết nối thành công! Đang đồng bộ hóa...\\\\x1b[0m\\\\r\\\\n');
            window.termWs.send(JSON.stringify({ "AuthToken": "", "columns": window.xterm.cols || 100, "rows": window.xterm.rows || 30 }));
        };
        window.termWs.onmessage = (ev) => {
            const processString = (msg) => { if (msg.startsWith('0')) window.xterm.write(msg.slice(1)); else if (!/^[12]/.test(msg)) window.xterm.write(msg); };
            if (ev.data instanceof ArrayBuffer) processString(decoder.decode(new Uint8Array(ev.data)));
            else if (typeof ev.data === 'string') processString(ev.data);
            else if (ev.data instanceof Blob) ev.data.text().then(processString);
        };
        window.termWs.onclose = () => { window.updateUIStatus('offline'); window.xterm.write('\\\\r\\\\n\\\\x1b[31m[Hệ thống] Kết nối đã đóng.\\\\x1b[0m\\\\r\\\\n'); };
        window.termWs.onerror = (err) => { window.updateUIStatus('error'); window.xterm.write('\\\\r\\\\n\\\\x1b[31m[Lỗi] Không thể kết nối tới server.\\\\x1b[0m\\\\r\\\\n'); };
        window.xterm.onData(data => { if (window.termWs && window.termWs.readyState === WebSocket.OPEN) window.termWs.send('0' + data); });
        window.xterm.onResize(size => { if (window.termWs && window.termWs.readyState === WebSocket.OPEN) window.termWs.send(JSON.stringify({ columns: size.cols, rows: size.rows })); });
        window.addEventListener('resize', () => window.xtermFit.fit());
    };

    window.resetTerminal = function() { if (window.currentTerminalNode) window.initXterm(window.currentTerminalNode); };
}`;

export const MODALS_JS = `// @ts-nocheck
if (typeof window !== 'undefined') {
    window.showModal = function({ title, message, content, mode, onConfirm }) {
        document.getElementById('modal-title').innerText = title || 'Notification';
        const msgEl = document.getElementById('modal-message');
        msgEl.style.display = message ? 'block' : 'none';
        if (message) msgEl.innerText = message;
        document.getElementById('modal-key-input').style.display = 'none';
        document.getElementById('editor-container').style.display = mode === 'editor' ? 'block' : 'none';
        document.getElementById('info-container').style.display = mode === 'info' ? 'block' : 'none';
        document.getElementById('modal-default-btns').style.display = mode !== 'confirm' ? 'flex' : 'none';
        document.getElementById('modal-save-btn').style.display = mode === 'editor' ? 'block' : 'none';
        document.getElementById('modal-confirm-btns').style.display = mode === 'confirm' ? 'flex' : 'none';
        if (mode === 'confirm' && onConfirm) document.getElementById('modal-confirm-action-btn').onclick = () => { onConfirm(); window.closeModal(); };
        if (mode === 'info' && content) document.getElementById('info-content').innerText = content;
        document.getElementById('modal').style.display = 'flex';
    };

    window.closeModal = function() { document.getElementById('modal').style.display = 'none'; };

    window.editKV = async function(k) {
        window.currentKey = k; window.isNew = false;
        window.showModal({ title: 'Edit ' + k, mode: 'editor' });
        document.getElementById('loader').style.display = 'block';
        try {
            const res = await fetch(\`/api/get-kv?token=\${window.TOKEN}&key=\${k}\`);
            document.getElementById('modal-textarea').value = await res.text();
        } catch (e) { }
        document.getElementById('loader').style.display = 'none';
    };

    window.saveContent = async function() {
        const val = document.getElementById('modal-textarea').value;
        document.getElementById('loader').style.display = 'block';
        try {
            await fetch(\`/api/save?token=\${window.TOKEN}\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: window.currentKey, value: val })
            });
            window.closeModal(); window.refreshData();
        } catch (e) { }
        document.getElementById('loader').style.display = 'none';
    };

    window.deleteKV = async function(key) {
        window.showModal({
            title: 'Delete Key', message: \`Delete key "\${key}"?\`, mode: 'confirm',
            onConfirm: async () => {
                document.getElementById('loader').style.display = 'block';
                try {
                    const res = await fetch(\`/api/delete?token=\${window.TOKEN}\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
                    const data = await res.json();
                    if (data.success) { window.showToast("Deleted!"); window.refreshData(); }
                } catch (e) { }
                document.getElementById('loader').style.display = 'none';
            }
        });
    };

    window.fetchNodeInfo = async function(h) {
        document.getElementById('loader').style.display = 'block';
        try {
            const res = await fetch(\`/api/node-proxy?token=\${window.TOKEN}&hostname=\${h}&endpoint=nodeinfo\`);
            const raw = await res.text();
            let display = raw;
            try { display = JSON.stringify(JSON.parse(raw), null, 4); } catch (e) { }
            window.showModal({ title: \`Node Info: \${h}\`, content: display, mode: 'info' });
        } catch (e) { window.showModal({ title: 'Error', message: 'Failed to fetch node info.', mode: 'alert' }); }
        document.getElementById('loader').style.display = 'none';
    };

    window.runNodeAction = async function(h, a) {
        const executeAction = async () => {
            document.getElementById('loader').style.display = 'block';
            try {
                await fetch(\`/api/node-proxy?token=\${window.TOKEN}&hostname=\${h}&endpoint=\${a}\`);
                window.showToast("Action requested!");
            } catch (e) { window.showToast("Action failed!"); }
            document.getElementById('loader').style.display = 'none';
        };
        if (['start', 'stop', 'reboot', 'destroy'].includes(a)) {
            window.showModal({ title: \`Confirm \${a.toUpperCase()}\`, message: \`Are you sure you want to \${a} node \${h}?\`, mode: 'confirm', onConfirm: executeAction });
        } else executeAction();
    };

    window.copyToClipboard = async function(text) { try { await navigator.clipboard.writeText(text); window.showToast("Copied!"); } catch (err) { } };
    
    window.showToast = function(msg) {
        const t = document.getElementById('toast');
        if (t) {
            t.innerText = msg; t.style.display = 'block';
            setTimeout(() => t.style.display = 'none', 2000);
        }
    };
}`;

export const LOGS_JS = `// @ts-nocheck
if (typeof window !== 'undefined') {
    window.viewNodeLogs = async function(h) {
        window.showSection('logs');
        document.getElementById('log-type-select').value = 'live';
        document.getElementById('log-host-filter').value = h;
        window.toggleLogView();
        window.refreshLogs();
    };

    window.toggleLogView = function() {
        const type = document.getElementById('log-type-select').value;
        document.getElementById('logs-list-system').style.display = type === 'system' ? 'block' : 'none';
        document.getElementById('logs-list-live').style.display = type === 'live' ? 'block' : 'none';
        window.refreshLogs();
    };

    window.refreshLogs = async function() {
        const type = document.getElementById('log-type-select').value;
        const host = document.getElementById('log-host-filter').value;
        const container = type === 'system' ? document.getElementById('logs-list-system') : document.getElementById('logs-list-live');
        if (!container) return;
        container.innerHTML = '<div style="opacity: 0.5; padding: 2rem;">Fetching logs...</div>';
        try {
            let url = \`/api/logs?token=\${window.TOKEN}&offset=0&limit=100\`;
            if (host) url += \`&hostname=\${host}\`;
            const res = await fetch(\`\${url}&_=\${Date.now()}\`);
            const logs = await res.json();
            window.renderLogs(container, logs);
        } catch(e) { container.innerHTML = 'Error loading logs.'; }
    };

    window.renderLogs = function(container, logs) {
        if (!logs.length) { container.innerHTML = '<div style="opacity: 0.5; padding: 2rem;">No logs found.</div>'; return; }
        let html = '';
        let lastDate = '';
        logs.forEach(l => {
            const d = new Date(l.time + " UTC");
            const dateStr = d.toLocaleDateString();
            if (dateStr !== lastDate) {
                html += \`<div class="log-date-header">\${dateStr}</div>\`;
                lastDate = dateStr;
            }
            html += \`<div style="font-family: monospace; font-size: 0.85rem; margin-bottom: 0.3rem; padding: 0.2rem 1rem; border-left: 2px solid var(--accent);">
                <span style="color: var(--text-dim);">[\${d.toLocaleTimeString()}]</span> \${l.msg}
            </div>\`;
        });
        container.innerHTML = html;
    };
}`;

export const MAIN_JS = `// @ts-nocheck
if (typeof window !== 'undefined') {
    window.autoRefreshInterval = null;
    window.countdown = 30;
    window.isLive = false;

    window.toggleAutoRefresh = function() {
        window.isLive = !window.isLive;
        const btn = document.getElementById('btn-live');
        const dot = document.getElementById('live-dot');
        const txt = document.getElementById('live-text');
        if (window.isLive) {
            btn.innerText = "Disable Auto-Live";
            dot.classList.add('active');
            window.startAutoRefresh();
        } else {
            btn.innerText = "Enable Auto-Live";
            dot.classList.remove('active');
            window.stopAutoRefresh();
            txt.innerText = "Live: Off";
        }
    };

    window.startAutoRefresh = function() {
        window.stopAutoRefresh();
        window.countdown = 30;
        window.updateLiveText();
        window.autoRefreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                window.countdown--;
                if (window.countdown <= 0) {
                    window.refreshStatusDots();
                    window.countdown = 30;
                }
                window.updateLiveText();
            }
        }, 1000);
    };

    window.stopAutoRefresh = function() {
        if (window.autoRefreshInterval) clearInterval(window.autoRefreshInterval);
        window.autoRefreshInterval = null;
    };

    window.updateLiveText = function() {
        document.getElementById('live-text').innerText = "Live in " + window.countdown + "s";
    };

    // Initial load
    if (window.TOKEN) {
        window.showSection('nodes');
        window.refreshData();
    } else {
        const warning = document.getElementById('auth-warning');
        if (warning) warning.style.display = 'block';
    }
}`;
