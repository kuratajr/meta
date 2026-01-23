// @ts-ignore
const TOKEN = new URLSearchParams(window.location.search).get('token');
let currentKey = '';
let isNew = false;
let groupsData: any[] = [];
let lastData: any = null;
let currentSearch = '';
let previousStatuses: Record<string, boolean> = {};
let currentStatusFilter = 'all';

// Log states for pagination
let logState = {
    system: { offset: 0, date: new Date().toLocaleDateString('en-CA'), hostname: '', loading: false, hasMore: true, lastDateStr: '' },
    live: { offset: 0, date: '', hostname: '', loading: false, hasMore: true, lastDateStr: '' }
};

export function handleStatusFilter(val: string) {
    currentStatusFilter = val;
    const table = document.getElementById('table-nodes');
    const label = document.getElementById('filter-label');
    if (!table || !label) return;
    table.classList.remove('filter-online', 'filter-offline');
    if (val === 'online') {
        table.classList.add('filter-online');
        label.innerText = 'Online';
    } else if (val === 'offline') {
        table.classList.add('filter-offline');
        label.innerText = 'Offline';
    } else {
        label.innerText = 'All';
    }
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
}

export function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('overlay')?.classList.toggle('show');
}

export function showSection(id: string) {
    if (window.innerWidth <= 768) toggleSidebar();
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const target = document.getElementById('section-' + id);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('onclick')?.includes("'" + id + "'")) item.classList.add('active');
    });

    let sectionTitle = id.charAt(0).toUpperCase() + id.slice(1);
    if (id === 'ip') sectionTitle = 'IP Management';
    else if (id === 'cloud') sectionTitle = 'Cloud-init Meta';
    else if (id === 'global') sectionTitle = 'Global & Security';
    else if (id === 'logs') { sectionTitle = 'System Logs & Activity'; resetSystemLogs(); }

    const titleEl = document.getElementById('section-title');
    if (titleEl) titleEl.innerText = sectionTitle;

    const btn = document.getElementById('btn-create');
    if (btn) btn.style.display = (id === 'templates' || id === 'configs' || id === 'global' || id === 'ip' || id === 'cloud') ? 'block' : 'none';

    const isTerminal = id === 'terminal';
    const statsGrid = document.querySelector('.stats-grid') as HTMLElement;
    if (statsGrid) statsGrid.style.display = isTerminal ? 'none' : 'grid';

    const liveIndicator = document.getElementById('live-indicator');
    if (liveIndicator) liveIndicator.style.display = 'flex';

    const btnLive = document.getElementById('btn-live');
    if (btnLive) btnLive.style.display = 'block';

    const refreshBtn = document.querySelector('.header')?.querySelector('button[onclick="refreshData()"]') as HTMLElement;
    if (refreshBtn) refreshBtn.style.display = 'block';

    // Conditional search visibility
    const hasTable = ['nodes', 'groups', 'ip', 'cloud', 'configs'].includes(id);
    const searchWrapper = document.getElementById('search-wrapper');
    if (searchWrapper) searchWrapper.style.display = hasTable ? 'block' : 'none';

    const statusFilterWrapper = document.getElementById('status-filter-wrapper');
    if (statusFilterWrapper) statusFilterWrapper.style.display = (id === 'nodes') ? 'inline-block' : 'none';
}

export async function refreshData() {
    if (!TOKEN) {
        const authWarning = document.getElementById('auth-warning');
        if (authWarning) authWarning.style.display = 'block';
        return;
    }

    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';

    const connStatus = document.getElementById('connection-status');
    if (connStatus) {
        connStatus.innerText = '● Syncing...';
        connStatus.style.color = 'var(--accent)';
    }

    try {
        const res = await fetch(`/api/data?token=${TOKEN}`);
        const data = await res.json();
        lastData = data;
        renderUI(data);

        // @ts-ignore
        if (window.lucide) lucide.createIcons();
        if (connStatus) {
            connStatus.innerText = '● Online';
            connStatus.style.color = 'var(--success)';
        }
    } catch (e) {
        console.error(e);
        if (connStatus) {
            connStatus.innerText = '● Offline';
            connStatus.style.color = 'var(--danger)';
        }
    }
    if (loader) loader.style.display = 'none';
}

export function handleSearch(val: string) {
    currentSearch = val.toLowerCase();
    if (!lastData) return;
    const activeSection = document.querySelector('.section.active');
    if (!activeSection) return;
    const activeId = activeSection.id.replace('section-', '');

    if (activeId === 'nodes') renderNodes(lastData);
    else if (activeId === 'groups') renderGroups(lastData);
    else if (activeId === 'ip') renderIPs(lastData);
    else if (activeId === 'cloud') renderCloudInit(lastData);
    else if (activeId === 'configs') renderConfigs(lastData);
    else if (activeId === 'templates') renderTemplates(lastData);
}

function renderUI(data: any) {
    groupsData = data.groups || [];
    const statNodes = document.getElementById('stat-nodes');
    if (statNodes) statNodes.innerText = Object.keys(data.registry).length.toString();

    const statGroups = document.getElementById('stat-groups');
    if (statGroups) statGroups.innerText = groupsData.length.toString();

    const statKv = document.getElementById('stat-kv');
    if (statKv) statKv.innerText = (data.templates.length + data.groupConfigs.length + data.nodeConfigs.length + data.certConfigs.length + (data.hasGlobal ? 1 : 0) + (data.cloudConfigs ? data.cloudConfigs.length : 0)).toString();

    renderNodes(data);
    renderGroups(data);
    renderTemplates(data);
    renderConfigs(data);
    renderIPs(data);
    renderCloudInit(data);

    const globalArea = document.getElementById('global-config-area');
    if (globalArea) {
        globalArea.innerHTML = data.hasGlobal ? `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><span>global.json</span><div class="action-flex"><button class="btn btn-s" onclick="editKV('global')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('global')"><i data-lucide="trash"></i>Delete</button></div></div>` : 'None.';
    }
    // @ts-ignore
    if (window.lucide) lucide.createIcons();
}

const getGroupOf = (node: string) => {
    const g = groupsData.find(g => (g.listnode || "").split(',').map((s: string) => s.trim()).includes(node));
    return g ? g.config : "None";
};

function renderNodes(data: any) {
    const nBody = document.querySelector('#table-nodes tbody');
    if (!nBody) return;
    let html = '';
    for (const h in data.registry) {
        const regVal = data.registry[h];
        const currentGroup = getGroupOf(h);
        if (currentSearch && !h.toLowerCase().includes(currentSearch) && !regVal.toLowerCase().includes(currentSearch) && !currentGroup.toLowerCase().includes(currentSearch)) continue;

        let groupOptions = '<option value="">None</option>';
        groupsData.forEach(g => { groupOptions += `<option value="${g.config}" ${g.config === currentGroup ? 'selected' : ''}>${g.config}</option>`; });

        html += `<tr data-status="${previousStatuses[h] === true ? 'online' : (previousStatuses[h] === false ? 'offline' : '')}">
            <td style="font-weight:600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                <span class="status-dot" data-node="${h}"></span>${h}
            </td>
            <td class="copyable" onclick="copyToClipboard('${regVal}')">
                <div style="font-size: 0.75rem; opacity: 0.6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${regVal}">${regVal}</div>
            </td>
            <td style="text-align: center;"><select onchange="updateNodeGroup('${h}', this.value)" style="padding: 0.3rem; font-size: 0.75rem;">${groupOptions}</select></td>
            <td style="text-align: center;">
                <div class="action-flex" style="justify-content: center;">
                    <button class="btn btn-s" onclick="editKV('node:${h}')"><i data-lucide="settings"></i>Config</button>
                    <button class="btn btn-start" onclick="runNodeAction('${h}', 'start')"><i data-lucide="play"></i>Start</button>
                    <button class="btn btn-destroy" onclick="runNodeAction('${h}', 'destroy')"><i data-lucide="trash-2"></i>Destroy</button>
                    <div class="dropdown">
                        <button class="btn btn-s dropdown-trigger" onclick="toggleDropdown(event)">More</button>
                        <div class="dropdown-content">
                            <div class="dropdown-scroll-area">
                                <div class="dropdown-item" onclick="openTerminal('${h}', '${regVal}')"><i data-lucide="terminal"></i>Terminal</div>
                                <div class="dropdown-item" onclick="fetchNodeInfo('${h}')"><i data-lucide="info"></i>Info</div>
                                <div class="dropdown-item" onclick="viewNodeLogs('${h}')"><i data-lucide="align-left"></i>Logs</div>
                                <div class="dropdown-item" onclick="runNodeAction('${h}', 'stop')"><i data-lucide="square"></i>Stop</div>
                                <div class="dropdown-item" onclick="runNodeAction('${h}', 'reboot')"><i data-lucide="refresh-cw"></i>Reboot</div>
                            </div>
                            <div class="dropdown-divider"></div>
                            <div class="dropdown-item" style="color:var(--danger);" onclick="deleteFromRegistry('${h}')"><i data-lucide="trash-2"></i>Delete</div>
                        </div>
                    </div>
                </div>
            </td>
        </tr>`;
    }
    nBody.innerHTML = html;
    refreshStatusDots();
    // @ts-ignore
    if (window.lucide) lucide.createIcons();
}

function renderGroups(data: any) {
    const mBody = document.querySelector('#table-mapping tbody');
    if (!mBody) return;
    mBody.innerHTML = (data.groups || []).filter((g: any) => !currentSearch || g.config.toLowerCase().includes(currentSearch) || (g.listnode || '').toLowerCase().includes(currentSearch)).map((g: any) => `<tr>
        <td style="font-weight:600; padding-left: 1.5rem;">${g.config}</td>
        <td style="opacity:0.8; font-size:0.85rem; line-height: 1.4; word-break: break-all; padding-right: 1rem;">${(g.listnode || 'None').split(',').join(', ')}</td>
        <td style="text-align: right; padding-right: 1.5rem;"><div class="action-flex" style="justify-content: flex-end;"><button class="btn btn-s" onclick="editKV('group:${g.config}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('group:${g.config}')"><i data-lucide="trash"></i>Delete</button></div></td>
    </tr>`).join('');
    // @ts-ignore
    if (window.lucide) lucide.createIcons();
}

function renderTemplates(data: any) {
    const tGrid = document.getElementById('grid-templates');
    if (!tGrid) return;
    tGrid.innerHTML = data.templates.filter((t: string) => !currentSearch || t.toLowerCase().includes(currentSearch)).map((t: string) => `<div class="card">
        <div style="font-weight:600; margin-bottom:0.8rem; display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="file-text" style="color: var(--accent); width: 0.95rem; height: 0.95rem;"></i>${t.replace('template:', '')}</div>
        <div class="action-flex"><button class="btn btn-s" onclick="editKV('${t}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('${t}')"><i data-lucide="trash"></i>Delete</button></div>
    </div>`).join('');
    // @ts-ignore
    if (window.lucide) lucide.createIcons();
}

function renderConfigs(data: any) {
    const filter = (arr: string[]) => arr.filter(c => !currentSearch || c.toLowerCase().includes(currentSearch)).map(c => `<div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:1rem; margin-bottom: 0.5rem;"><span>${c}</span><div class="action-flex"><button class="btn btn-s" onclick="editKV('${c}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('${c}')"><i data-lucide="trash"></i>Delete</button></div></div>`).join('');

    const groupConfigs = document.getElementById('list-group-configs');
    if (groupConfigs) groupConfigs.innerHTML = filter(data.groupConfigs);

    const nodeConfigs = document.getElementById('list-node-configs');
    if (nodeConfigs) nodeConfigs.innerHTML = filter(data.nodeConfigs);

    const certConfigs = document.getElementById('list-cert-configs');
    if (certConfigs) certConfigs.innerHTML = filter(data.certConfigs);

    // @ts-ignore
    if (window.lucide) lucide.createIcons();
}

function renderIPs(data: any) {
    const ipBody = document.querySelector('#table-ips tbody');
    if (!ipBody) return;
    ipBody.innerHTML = Object.keys(data.ips || {}).filter(node => !currentSearch || node.toLowerCase().includes(currentSearch) || (data.ips[node] || '').toLowerCase().includes(currentSearch)).map(node => `<tr>
        <td style="font-weight:600; padding-left: 1.5rem;">ip:${node}</td>
        <td class="copyable" onclick="copyToClipboard('${data.ips[node]}')"><div style="opacity: 0.8; font-size: 0.85rem;">${data.ips[node]}</div></td>
        <td style="text-align: right; padding-right: 1.5rem;"><div class="action-flex" style="justify-content: flex-end;"><button class="btn btn-s" onclick="editIP('${node}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteIP('${node}')"><i data-lucide="trash"></i>Delete</button></div></td>
    </tr>`).join('');
    // @ts-ignore
    if (window.lucide) lucide.createIcons();
}

function renderCloudInit(data: any) {
    const cloudBody = document.querySelector('#table-cloud tbody');
    if (!cloudBody) return;
    cloudBody.innerHTML = (data.cloudConfigs || []).filter((c: string) => !currentSearch || c.toLowerCase().includes(currentSearch)).map((c: string) => `<tr>
        <td style="font-weight:600; padding-left: 1.5rem;">${c}</td>
        <td><span class="badge badge-accent">KV Storage</span></td>
        <td style="text-align: right; padding-right: 1.5rem;"><div class="action-flex" style="justify-content: flex-end;"><button class="btn btn-s" onclick="editKV('${c}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('${c}')"><i data-lucide="trash"></i>Delete</button></div></td>
    </tr>`).join('');
    // @ts-ignore
    if (window.lucide) lucide.createIcons();
}

async function refreshStatusDots() {
    if (!lastData || !lastData.registry) return;
    const hostnames = Object.keys(lastData.registry);
    const batchSize = 40;
    const total = hostnames.length;

    const promises: Promise<any>[] = [];
    for (let i = 0; i < total; i += batchSize) {
        promises.push(
            fetch(`/api/batch-check-nodes?token=${TOKEN}&offset=${i}&limit=${batchSize}&_=${Date.now()}`)
                .then(r => r.json())
                .catch(() => ({}))
        );
    }

    try {
        const results = await Promise.all(promises);
        const allStatuses = Object.assign({}, ...results);

        for (const node of hostnames) {
            const newStatus = allStatuses[node];
            const prevStatus = previousStatuses[node];

            if (prevStatus !== undefined && newStatus !== prevStatus) {
                const msg = `Node [${node}] is now ${newStatus ? 'ONLINE' : 'OFFLINE'}`;
                fetch(`/api/record-log?token=${TOKEN}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ msg, node })
                }).catch(() => { });
                if (document.getElementById('section-logs')?.classList.contains('active')) fetchSystemLogs();
            }
            previousStatuses[node] = newStatus;
        }

        document.querySelectorAll('.status-dot').forEach(dot => {
            const node = dot.getAttribute('data-node');
            if (!node) return;
            const row = dot.closest('tr');
            if (allStatuses[node] === true) {
                dot.className = 'status-dot online';
                if (row) row.setAttribute('data-status', 'online');
            }
            else if (allStatuses[node] === false) {
                dot.className = 'status-dot offline';
                if (row) row.setAttribute('data-status', 'offline');
            }
        });
    } catch (e) { }
}

export async function fetchSystemLogs(append = false) {
    const state = logState.system;
    if (state.loading) return;
    if (append && !state.hasMore) return;

    const container = document.getElementById('system-logs');
    if (!container) return;
    if (!append) {
        container.innerHTML = '<div style="opacity: 0.5;">Loading logs...</div>';
        state.offset = 0;
        state.hasMore = true;
        state.lastDateStr = '';
    }

    state.loading = true;
    container.style.opacity = '0.6';
    try {
        let url = `/api/logs?token=${TOKEN}&offset=${state.offset}&limit=100`;
        if (state.date) url += `&date=${state.date}`;

        const res = await fetch(`${url}&_=${Date.now()}`);
        const logs = await res.json();

        if (logs.length < 100) state.hasMore = false;

        let html = '';

        logs.forEach((l: any) => {
            const dateObj = new Date(l.time + " UTC");
            const dateStr = dateObj.toLocaleDateString('en-GB');

            if (dateStr !== state.lastDateStr) {
                html += `<div class="log-date-header">${dateStr}</div>`;
                state.lastDateStr = dateStr;
            }

            html += `<div class="log-entry"><span class="log-time">${dateObj.toLocaleTimeString()}</span>${l.msg}</div>`;
        });

        if (!append) {
            container.innerHTML = html || '<div style="opacity:0.5">No logs yet.</div>';
        } else {
            if (logs.length > 0) {
                const temp = document.createElement('div');
                temp.innerHTML = html;
                while (temp.firstChild) container.appendChild(temp.firstChild);
            }
        }

        state.offset += logs.length;
    } catch (e) {
        console.error("Fetch system logs error:", e);
    } finally {
        state.loading = false;
        container.style.opacity = '1';
    }
}

export function handleSystemDateChange(val: string) {
    if (!val) { resetSystemLogs(); return; }
    logState.system.date = val;
    fetchSystemLogs(false);
}

export function resetSystemLogs() {
    const today = new Date().toLocaleDateString('en-CA');
    logState.system.date = today;
    const input = document.getElementById('system-log-date') as HTMLInputElement;
    if (input) input.value = today;
    fetchSystemLogs(false);
}

export function handleLogScroll(e: Event, type: 'system' | 'live') {
    const el = e.target as HTMLElement;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
        if (type === 'system' && logState.system.hasMore) {
            fetchSystemLogs(true);
        } else if (type === 'live' && logState.live.hasMore) {
            fetchLiveNodeLogs(logState.live.hostname, true);
        }
    }
}

export async function viewNodeLogs(h: string) {
    showSection('logs');
    logState.live.hostname = h;
    logState.live.offset = 0;
    logState.live.hasMore = true;
    logState.live.lastDateStr = '';
    const resetBtn = document.getElementById('btn-reset-live');
    if (resetBtn) resetBtn.style.display = 'block';
    fetchLiveNodeLogs(h, false);
}

export function resetLiveLogs() {
    logState.live.hostname = '';
    const nodeSpan = document.getElementById('current-log-node');
    if (nodeSpan) nodeSpan.innerText = 'None';
    const container = document.getElementById('live-logs');
    if (container) container.innerHTML = '<div style="opacity: 0.5;">Select a node to view live logs...</div>';
    const resetBtn = document.getElementById('btn-reset-live');
    if (resetBtn) resetBtn.style.display = 'none';
}

async function fetchLiveNodeLogs(h: string, append = false) {
    const state = logState.live;
    if (state.loading) return;
    if (append && !state.hasMore) return;

    const container = document.getElementById('live-logs');
    if (!container) return;

    const nodeSpan = document.getElementById('current-log-node');
    if (nodeSpan) nodeSpan.innerText = h;

    if (!append) {
        container.innerHTML = '<div style="opacity:0.5">Fetching history for ' + h + '...</div>';
        state.offset = 0;
        state.hasMore = true;
        state.lastDateStr = '';
    }

    state.loading = true;
    try {
        const res = await fetch(`/api/logs?token=${TOKEN}&hostname=${h}&offset=${state.offset}&limit=100&_=${Date.now()}`);
        const logs = await res.json();

        if (logs.length < 100) state.hasMore = false;

        let html = '';
        if (!append) {
            html += '<div style="background:#000; color:#0f0; padding:1.5rem; border-radius:1rem; border:1px solid var(--glass-border); line-height:1.5; font-size:0.85rem; font-family:\'Courier New\', Courier, monospace; min-height:400px;">';
        }

        logs.forEach((l: any) => {
            const dateObj = new Date(l.time + " UTC");
            const dateStr = dateObj.toLocaleDateString('en-GB');
            if (dateStr !== state.lastDateStr) {
                html += `<div class="log-date-header" style="margin-top:${state.lastDateStr ? '1.5rem' : '0'}">${dateStr}</div>`;
                state.lastDateStr = dateStr;
            }
            html += `<div class="log-entry" style="margin-bottom:0.4rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.2rem;"><span class="log-time" style="color:var(--accent); font-size:0.75rem; margin-right:0.8rem;">${dateObj.toLocaleTimeString()}</span>${l.msg}</div>`;
        });

        if (!append) {
            html += (logs.length === 0 ? '<div style="opacity:0.5">No history found for this node.</div>' : '') + '</div>';
            html += `<div style="margin-top:1rem; text-align:right;"><button class="btn btn-s" onclick="fetchRawShellLogs('${h}')"><i data-lucide="terminal"></i> View Raw Shell Logs</button></div>`;
            container.innerHTML = html;
        } else {
            const innerContainer = container.querySelector('div[style*="background:#000"]');
            if (innerContainer && logs.length > 0) {
                const temp = document.createElement('div');
                temp.innerHTML = html;
                while (temp.firstChild) innerContainer.appendChild(temp.firstChild);
            }
        }

        state.offset += logs.length;
        // @ts-ignore
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        if (!append) container.innerHTML = '<div style="color:var(--danger)">Failed to fetch node history.</div>';
    } finally {
        state.loading = false;
    }
}

// Global exposure for event handlers in HTML
(window as any).handleStatusFilter = handleStatusFilter;
(window as any).toggleSidebar = toggleSidebar;
(window as any).showSection = showSection;
(window as any).refreshData = refreshData;
(window as any).handleSearch = handleSearch;
(window as any).handleSystemDateChange = handleSystemDateChange;
(window as any).resetSystemLogs = resetSystemLogs;
(window as any).handleLogScroll = handleLogScroll;
(window as any).viewNodeLogs = viewNodeLogs;
(window as any).resetLiveLogs = resetLiveLogs;


export async function fetchRawShellLogs(h: string) {
    const container = document.getElementById('live-logs');
    if (!container) return;
    container.innerHTML = '<div style="opacity:0.5">Fetching raw shell logs from ' + h + '...</div>';
    try {
        const res = await fetch(`/api/node-proxy?token=${TOKEN}&hostname=${h}&endpoint=logs`);
        const data = await res.text();
        let html = `<div style="margin-bottom:1rem;"><button class="btn btn-s" onclick="viewNodeLogs('${h}')"><i data-lucide="arrow-left"></i> Back to History</button></div>`;
        html += `<div style="background:#000; color:#0f0; padding:1.5rem; border-radius:1rem; border:1px solid var(--glass-border); line-height:1.5; font-size:0.85rem; font-family:'Courier New', Courier, monospace; min-height:400px; max-height:600px; overflow-y:auto; white-space:pre-wrap;">${data || 'No shell logs returned.'}</div>`;
        container.innerHTML = html;
        // @ts-ignore
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        container.innerHTML = '<div style="color:var(--danger)">Failed to fetch raw shell logs.</div>';
    }
}

export function toggleDropdown(event: Event) {
    event.stopPropagation();
    const btn = event.currentTarget as HTMLElement;
    const content = btn.nextElementSibling as HTMLElement;
    if (!content) return;
    const isShow = content.classList.contains('show');

    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));

    if (!isShow) {
        const rect = btn.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const spaceBelow = windowHeight - rect.bottom;
        const dropdownHeight = 200;

        if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
            content.classList.add('drop-up');
        } else {
            content.classList.remove('drop-up');
        }
        content.classList.add('show');
    }
}

window.onclick = function (event: MouseEvent) {
    if (!(event.target as HTMLElement).matches('.dropdown-trigger')) {
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.table-container').forEach(c => c.addEventListener('scroll', () => {
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
    }));
});

export async function copyToClipboard(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        showToast("Copied!");
    } catch (err) { }
}

function showToast(msg: string) {
    const t = document.getElementById('toast');
    if (t) {
        t.innerText = msg; t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 2000);
    }
}

export async function fetchNodeInfo(h: string) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';
    try {
        const res = await fetch(`/api/node-proxy?token=${TOKEN}&hostname=${h}&endpoint=nodeinfo`);
        const raw = await res.text();
        let display = raw;
        try { display = JSON.stringify(JSON.parse(raw), null, 4); } catch (e) { }
        showModal({ title: `Node Info: ${h}`, content: display, mode: 'info' });
    } catch (e) { showModal({ title: 'Error', message: 'Failed to fetch node info.', mode: 'alert' }); }
    if (loader) loader.style.display = 'none';
}

export async function runNodeAction(h: string, a: string) {
    const executeAction = async () => {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'block';
        try {
            await fetch(`/api/node-proxy?token=${TOKEN}&hostname=${h}&endpoint=${a}`);
            const msg = `Requested action: ${a.toUpperCase()}`;
            fetch(`/api/record-log?token=${TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ msg, node: h })
            }).catch(() => { });
            showModal({ title: 'Action Sent', message: `Action ${a} for node ${h} has been requested.`, mode: 'alert' });
        } catch (e) {
            showModal({ title: 'Error', message: `Failed to execute ${a}.`, mode: 'alert' });
        }
        if (loader) loader.style.display = 'none';
    };

    if (['start', 'stop', 'reboot', 'destroy'].includes(a)) {
        showModal({
            title: `Confirm ${a.toUpperCase()}`,
            message: `Are you sure you want to ${a} node ${h}?`,
            mode: 'confirm',
            onConfirm: executeAction
        });
    } else {
        executeAction();
    }
}

export async function updateNodeGroup(h: string, g: string) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';
    const updated = groupsData.map((item: any) => {
        let nodes = (item.listnode || "").split(',').map((s: string) => s.trim()).filter((s: string) => s && s !== h);
        if (item.config === g) nodes.push(h);
        return { ...item, listnode: nodes.join(',') };
    });
    try {
        await fetch(`/api/save?token=${TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'groups', value: JSON.stringify(updated, null, 2) })
        });
        refreshData();
    } catch (e) { }
}

export async function deleteFromRegistry(h: string) {
    showModal({
        title: 'Delete Node',
        message: `Are you sure you want to delete ${h} from the registry?`,
        mode: 'confirm',
        onConfirm: async () => {
            const loader = document.getElementById('loader');
            if (loader) loader.style.display = 'block';
            try {
                const res = await fetch(`/api/data?token=${TOKEN}`);
                const data = await res.json();
                const registry = data.registry;
                delete registry[h];
                await fetch(`/api/save?token=${TOKEN}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'registry', value: JSON.stringify(registry, null, 4) })
                });
                const updatedGroups = (data.groups || []).map((item: any) => {
                    let nodes = (item.listnode || "").split(',').map((s: string) => s.trim()).filter((s: string) => s && s !== h);
                    return { ...item, listnode: nodes.join(',') };
                });
                await fetch(`/api/save?token=${TOKEN}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'groups', value: JSON.stringify(updatedGroups, null, 4) })
                });
                showToast("Node removed!");
                refreshData();
            } catch (e) { }
            if (loader) loader.style.display = 'none';
        }
    });
}

export async function editKV(k: string) {
    currentKey = k; isNew = false;
    showModal({ title: 'Edit ' + k, mode: 'editor' });
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';
    try {
        const res = await fetch(`/api/get-kv?token=${TOKEN}&key=${k}`);
        const editor = document.getElementById('editor') as HTMLTextAreaElement;
        if (editor) editor.value = await res.text();
    } catch (e) { }
    if (loader) loader.style.display = 'none';
}

export function openCreateModal() {
    isNew = true;
    const activeSection = document.querySelector('.section.active');
    const currentSection = activeSection ? activeSection.id : '';
    showModal({ title: 'Create New Configuration', mode: 'editor' });
    const keyInput = document.getElementById('modal-key-input');
    if (keyInput) keyInput.style.display = 'block';

    let defaultKey = '';
    if (currentSection === 'section-ip') defaultKey = 'ip:';
    else if (currentSection === 'section-cloud') defaultKey = 'cloud:';

    const keyNameInput = document.getElementById('new-key-name') as HTMLInputElement;
    if (keyNameInput) keyNameInput.value = defaultKey;

    const editor = document.getElementById('editor') as HTMLTextAreaElement;
    if (editor) editor.value = '{}';
}

export async function editIP(node: string) {
    currentKey = 'ip:' + node; isNew = false;
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) modalTitle.innerText = 'Edit IP: ' + node;

    const keyInput = document.getElementById('modal-key-input');
    if (keyInput) keyInput.style.display = 'none';

    const editorCont = document.getElementById('editor-container');
    if (editorCont) editorCont.style.display = 'block';

    const infoCont = document.getElementById('info-container');
    if (infoCont) infoCont.style.display = 'none';

    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) saveBtn.style.display = 'block';

    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';

    try {
        const res = await fetch(`/api/data?token=${TOKEN}`);
        const data = await res.json();
        const editor = document.getElementById('editor') as HTMLTextAreaElement;
        if (editor) editor.value = data.ips[node] || "";
        const modal = document.getElementById('modal');
        if (modal) modal.style.display = 'flex';
    } catch (e) { }
    if (loader) loader.style.display = 'none';
}

export async function saveData() {
    const activeSection = document.querySelector('.section.active');
    const currentSection = activeSection ? activeSection.id : '';
    const keyNameInput = document.getElementById('new-key-name') as HTMLInputElement;
    const key = isNew ? keyNameInput.value : currentKey;
    const editor = document.getElementById('editor') as HTMLTextAreaElement;
    const val = editor ? editor.value : '';

    if (!key) return showModal({ title: 'Input Required', message: 'Key name is required.', mode: 'alert' });

    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';

    try {
        if (currentSection === 'section-ip' || (key.startsWith('ip:') && !isNew)) {
            const node = key.startsWith('ip:') ? key.replace('ip:', '') : key;
            const res = await fetch(`/api/data?token=${TOKEN}`);
            const data = await res.json();
            const ips = data.ips || {};
            ips[node] = val;
            await fetch(`/api/save?token=${TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'ips', value: JSON.stringify(ips, null, 2) })
            });
        } else {
            await fetch(`/api/save?token=${TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value: val })
            });
        }
        closeModal(); refreshData();
    } catch (e) { }
    if (loader) loader.style.display = 'none';
}

export async function deleteIP(node: string) {
    showModal({
        title: 'Delete IP',
        message: `Delete ip:${node}?`,
        mode: 'confirm',
        onConfirm: async () => {
            const loader = document.getElementById('loader');
            if (loader) loader.style.display = 'block';
            try {
                const res = await fetch(`/api/data?token=${TOKEN}`);
                const data = await res.json();
                const ips = data.ips || {};
                delete ips[node];
                await fetch(`/api/save?token=${TOKEN}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'ips', value: JSON.stringify(ips, null, 2) })
                });
                showToast("Deleted!");
                refreshData();
            } catch (e) { }
            if (loader) loader.style.display = 'none';
        }
    });
}

export async function deleteKV(key: string) {
    showModal({
        title: 'Delete Key',
        message: `Delete key "${key}"?`,
        mode: 'confirm',
        onConfirm: async () => {
            const loader = document.getElementById('loader');
            if (loader) loader.style.display = 'block';
            try {
                const res = await fetch(`/api/delete?token=${TOKEN}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key })
                });
                const data = await res.json();
                if (data.success) {
                    showToast("Deleted!");
                    refreshData();
                }
            } catch (e) { }
            if (loader) loader.style.display = 'none';
        }
    });
}

function showModal({ title, message, content, mode, onConfirm }: { title: string, message?: string, content?: string, mode: string, onConfirm?: Function }) {
    const titleEl = document.getElementById('modal-title');
    if (titleEl) titleEl.innerText = title || 'Notification';

    const msgEl = document.getElementById('modal-message');
    if (msgEl) {
        msgEl.style.display = message ? 'block' : 'none';
        if (message) msgEl.innerText = message;
    }

    const keyInput = document.getElementById('modal-key-input');
    if (keyInput) keyInput.style.display = 'none';

    const editorCont = document.getElementById('editor-container');
    if (editorCont) editorCont.style.display = mode === 'editor' ? 'block' : 'none';

    const infoCont = document.getElementById('info-container');
    if (infoCont) infoCont.style.display = mode === 'info' ? 'block' : 'none';

    const defaultBtns = document.getElementById('modal-default-btns');
    if (defaultBtns) defaultBtns.style.display = mode !== 'confirm' ? 'flex' : 'none';

    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) saveBtn.style.display = mode === 'editor' ? 'block' : 'none';

    const confirmBtns = document.getElementById('modal-confirm-btns');
    if (confirmBtns) confirmBtns.style.display = mode === 'confirm' ? 'flex' : 'none';

    if (mode === 'confirm' && onConfirm) {
        const confirmActionBtn = document.getElementById('modal-confirm-action-btn');
        if (confirmActionBtn) confirmActionBtn.onclick = () => {
            onConfirm();
            closeModal();
        };
    }

    if (mode === 'info' && content) {
        const infoContent = document.getElementById('info-content');
        if (infoContent) infoContent.innerText = content;
    }
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'flex';
}

(window as any).fetchRawShellLogs = fetchRawShellLogs;
(window as any).toggleDropdown = toggleDropdown;
(window as any).copyToClipboard = copyToClipboard;
(window as any).fetchNodeInfo = fetchNodeInfo;
(window as any).runNodeAction = runNodeAction;
(window as any).updateNodeGroup = updateNodeGroup;
(window as any).deleteFromRegistry = deleteFromRegistry;
(window as any).editKV = editKV;
(window as any).openCreateModal = openCreateModal;
(window as any).editIP = editIP;
(window as any).saveData = saveData;
(window as any).deleteIP = deleteIP;
(window as any).deleteKV = deleteKV;
(window as any).closeModal = closeModal;

// Terminal and logic
// @ts-ignore
let xterm: any = null;
// @ts-ignore
let xtermFit: any = null;
let termWs: WebSocket | null = null;
let currentTerminalNode = '';
let currentTerminalUrl = '';

function updateUIStatus(newStatus: string) {
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
}

export function openTerminal(h: string, hostUrl: string) {
    currentTerminalNode = h;
    currentTerminalUrl = hostUrl;
    showSection('terminal');

    const terminalTitle = document.getElementById('terminal-section-title');
    if (terminalTitle) terminalTitle.innerText = h;

    const originUrl = hostUrl.startsWith('http') ? hostUrl : "https://8877-" + hostUrl;
    const newTabBtn = document.getElementById('terminal-new-tab-btn') as HTMLElement;
    if (newTabBtn) newTabBtn.dataset.url = originUrl;

    updateUIStatus('connecting');
    initXterm(h);
}

function initXterm(h: string) {
    if (termWs) { try { termWs.close(); } catch (e) { } }
    termWs = null;
    const container = document.getElementById('xterm-container');
    if (container) container.innerHTML = '';

    // @ts-ignore
    xterm = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontFamily: '"Ubuntu Mono", monospace',
        fontSize: 14,
        letterSpacing: 0.5,
        theme: {
            background: 'rgba(0, 0, 0, 0)',
            foreground: '#e6edf3',
            cursor: '#58a6ff',
            selection: 'rgba(88, 166, 255, 0.3)',
            black: '#484f58',
            red: '#ff7b72',
            green: '#3fb950',
            yellow: '#d29922',
            blue: '#58a6ff',
            magenta: '#bc8cff',
            cyan: '#39c5cf',
            white: '#b1bac4',
            brightBlack: '#6e7681',
            brightRed: '#ffa198',
            brightGreen: '#56d364',
            brightYellow: '#e3b341',
            brightBlue: '#79c0ff',
            brightMagenta: '#d2a8ff',
            brightCyan: '#56d4dd',
            brightWhite: '#ffffff',
        },
        allowTransparency: true,
        cols: 100,
        rows: 30
    });

    // @ts-ignore
    xtermFit = new FitAddon.FitAddon();
    xterm.loadAddon(xtermFit);
    xterm.open(container);

    setTimeout(() => {
        try {
            xtermFit.fit();
            connectWs(h);
        } catch (e) {
            console.error("Fit error:", e);
            connectWs(h);
        }
    }, 150);
}

function connectWs(h: string) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + "//" + location.host + "/terminal-proxy/" + TOKEN + "/" + h + "/ws";

    termWs = new WebSocket(wsUrl, 'tty');
    termWs.binaryType = 'arraybuffer';

    const decoder = new TextDecoder();

    termWs.onopen = () => {
        updateUIStatus('online');
        xterm.write('\x1b[38;5;82m[Hệ thống] Kết nối thành công! Đang đồng bộ hóa...\x1b[0m\r\n');

        const initMsg = JSON.stringify({
            "AuthToken": "",
            "columns": xterm.cols || 100,
            "rows": xterm.rows || 30
        });
        termWs!.send(initMsg);
    };

    termWs.onmessage = (ev) => {
        const processString = (msg: string) => {
            if (msg.startsWith('0')) {
                xterm.write(msg.slice(1));
            } else if (!/^[12]/.test(msg)) {
                xterm.write(msg);
            }
        };

        if (ev.data instanceof ArrayBuffer) {
            processString(decoder.decode(new Uint8Array(ev.data)));
        } else if (typeof ev.data === 'string') {
            processString(ev.data);
        } else if (ev.data instanceof Blob) {
            ev.data.text().then(processString);
        }
    };

    termWs.onclose = () => {
        updateUIStatus('offline');
        xterm.write('\r\n\x1b[31m[Hệ thống] Kết nối đã đóng.\x1b[0m\r\n');
    };

    termWs.onerror = (err) => {
        updateUIStatus('error');
        xterm.write('\r\n\x1b[31m[Lỗi] Không thể kết nối tới server.\x1b[0m\r\n');
        console.error('WebSocket Error:', err);
    };

    xterm.onData((data: string) => {
        if (termWs && termWs.readyState === WebSocket.OPEN) {
            termWs.send('0' + data);
        }
    });

    xterm.onResize((size: { cols: number, rows: number }) => {
        if (termWs && termWs.readyState === WebSocket.OPEN) {
            termWs.send(JSON.stringify({ columns: size.cols, rows: size.rows }));
        }
    });

    window.addEventListener('resize', () => xtermFit.fit());
}

export function resetTerminal() {
    if (currentTerminalNode) initXterm(currentTerminalNode);
}

let autoRefreshInterval: any = null;
let countdown = 30;
let isLive = false;

export function toggleAutoRefresh() {
    isLive = !isLive;
    const btn = document.getElementById('btn-live');
    const dot = document.getElementById('live-dot');
    const txt = document.getElementById('live-text');
    if (!btn || !dot || !txt) return;

    if (isLive) {
        btn.innerText = "Disable Auto-Live";
        dot.classList.add('active');
        startAutoRefresh();
    } else {
        btn.innerText = "Enable Auto-Live";
        dot.classList.remove('active');
        stopAutoRefresh();
        txt.innerText = "Live: Off";
    }
}

function startAutoRefresh() {
    stopAutoRefresh();
    countdown = 30;
    updateLiveText();
    autoRefreshInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
            countdown--;
            if (countdown <= 0) {
                refreshStatusDots();
                countdown = 30;
            }
            updateLiveText();
        }
    }, 1000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
}

function updateLiveText() {
    const txt = document.getElementById('live-text');
    if (txt) txt.innerText = "Live in " + countdown + "s";
}

// Global exposure for everything
(window as any).originalRefreshData = refreshData;
(window as any).refreshData = async () => {
    // @ts-ignore
    await (window as any).originalRefreshData();
    if (isLive) countdown = 30;
};

if (TOKEN) {
    const today = new Date().toLocaleDateString('en-CA');
    const systemLogDateInput = document.getElementById('system-log-date') as HTMLInputElement;
    if (systemLogDateInput) systemLogDateInput.value = today;

    showSection('nodes');
    refreshData();
} else {
    const authWarning = document.getElementById('auth-warning');
    if (authWarning) authWarning.style.display = 'block';
}

(window as any).openTerminal = openTerminal;
(window as any).resetTerminal = resetTerminal;
(window as any).toggleAutoRefresh = toggleAutoRefresh;
(window as any).closeModal = closeModal;

