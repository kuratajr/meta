const TOKEN = new URLSearchParams(window.location.search).get('token');
let currentKey = '';
let isNew = false;
let groupsData = [];
let lastData = null;
let currentSearch = '';
let previousStatuses = {};
let currentStatusFilter = 'all';

// Log states for pagination
let logState = {
    system: { offset: 0, date: new Date().toLocaleDateString('en-CA'), hostname: '', loading: false, hasMore: true, lastDateStr: '' },
    live: { offset: 0, date: '', hostname: '', loading: false, hasMore: true, lastDateStr: '' }
};

function handleStatusFilter(val) {
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

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('show');
}

function showSection(id) {
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
    document.getElementById('section-title').innerText = sectionTitle;
    const btn = document.getElementById('btn-create');
    btn.style.display = (id === 'templates' || id === 'configs' || id === 'global' || id === 'ip' || id === 'cloud') ? 'block' : 'none';

    const isTerminal = id === 'terminal';
    document.querySelector('.stats-grid').style.display = isTerminal ? 'none' : 'grid';
    document.getElementById('live-indicator').style.display = 'flex';
    document.getElementById('btn-live').style.display = 'block';
    document.querySelector('.header').querySelector('button[onclick="refreshData()"]').style.display = 'block';

    // Conditional search visibility
    const hasTable = ['nodes', 'groups', 'ip', 'cloud', 'configs'].includes(id);
    document.getElementById('search-wrapper').style.display = hasTable ? 'block' : 'none';
    document.getElementById('status-filter-wrapper').style.display = (id === 'nodes') ? 'inline-block' : 'none';
}

async function refreshData() {
    if (!TOKEN) { document.getElementById('auth-warning').style.display = 'block'; return; }
    document.getElementById('loader').style.display = 'block';
    document.getElementById('connection-status').innerText = '● Syncing...';
    document.getElementById('connection-status').style.color = 'var(--accent)';

    try {
        const res = await fetch(`/api/data?token=${TOKEN}`);
        const data = await res.json();
        lastData = data;
        renderUI(data);

        if (window.lucide) lucide.createIcons();
        document.getElementById('connection-status').innerText = '● Online';
        document.getElementById('connection-status').style.color = 'var(--success)';
    } catch (e) {
        console.error(e);
        document.getElementById('connection-status').innerText = '● Offline';
        document.getElementById('connection-status').style.color = 'var(--danger)';
    }
    document.getElementById('loader').style.display = 'none';
}

function handleSearch(val) {
    currentSearch = val.toLowerCase();
    if (!lastData) return;
    const activeId = document.querySelector('.section.active').id.replace('section-', '');
    if (activeId === 'nodes') renderNodes(lastData);
    else if (activeId === 'groups') renderGroups(lastData);
    else if (activeId === 'ip') renderIPs(lastData);
    else if (activeId === 'cloud') renderCloudInit(lastData);
    else if (activeId === 'configs') renderConfigs(lastData);
    else if (activeId === 'templates') renderTemplates(lastData);
}

function renderUI(data) {
    groupsData = data.groups || [];
    document.getElementById('stat-nodes').innerText = Object.keys(data.registry).length;
    document.getElementById('stat-groups').innerText = groupsData.length;
    document.getElementById('stat-kv').innerText = (data.templates.length + data.groupConfigs.length + data.nodeConfigs.length + data.certConfigs.length + (data.hasGlobal ? 1 : 0) + (data.cloudConfigs ? data.cloudConfigs.length : 0));

    renderNodes(data);
    renderGroups(data);
    renderTemplates(data);
    renderConfigs(data);
    renderIPs(data);
    renderCloudInit(data);

    document.getElementById('global-config-area').innerHTML = data.hasGlobal ? `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><span>global.json</span><div class="action-flex"><button class="btn btn-s" onclick="editKV('global')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('global')"><i data-lucide="trash"></i>Delete</button></div></div>` : 'None.';
    if (window.lucide) lucide.createIcons();
}

const getGroupOf = (node) => {
    const g = groupsData.find(g => (g.listnode || "").split(',').map(s => s.trim()).includes(node));
    return g ? g.config : "None";
};

function renderNodes(data) {
    const nBody = document.querySelector('#table-nodes tbody');
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
    if (window.lucide) lucide.createIcons();
}

function renderGroups(data) {
    const mBody = document.querySelector('#table-mapping tbody');
    if (!mBody) return;
    mBody.innerHTML = (data.groups || []).filter(g => !currentSearch || g.config.toLowerCase().includes(currentSearch) || (g.listnode || '').toLowerCase().includes(currentSearch)).map(g => `<tr>
        <td style="font-weight:600; padding-left: 1.5rem;">${g.config}</td>
        <td style="opacity:0.8; font-size:0.85rem; line-height: 1.4; word-break: break-all; padding-right: 1rem;">${(g.listnode || 'None').split(',').join(', ')}</td>
        <td style="text-align: right; padding-right: 1.5rem;"><div class="action-flex" style="justify-content: flex-end;"><button class="btn btn-s" onclick="editKV('group:${g.config}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('group:${g.config}')"><i data-lucide="trash"></i>Delete</button></div></td>
    </tr>`).join('');
    if (window.lucide) lucide.createIcons();
}

function renderTemplates(data) {
    const tGrid = document.getElementById('grid-templates');
    if (!tGrid) return;
    tGrid.innerHTML = data.templates.filter(t => !currentSearch || t.toLowerCase().includes(currentSearch)).map(t => `<div class="card">
        <div style="font-weight:600; margin-bottom:0.8rem; display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="file-text" style="color: var(--accent); width: 0.95rem; height: 0.95rem;"></i>${t.replace('template:', '')}</div>
        <div class="action-flex"><button class="btn btn-s" onclick="editKV('${t}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('${t}')"><i data-lucide="trash"></i>Delete</button></div>
    </div>`).join('');
    if (window.lucide) lucide.createIcons();
}

function renderConfigs(data) {
    const filter = (arr) => arr.filter(c => !currentSearch || c.toLowerCase().includes(currentSearch)).map(c => `<div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:1rem; margin-bottom: 0.5rem;"><span>${c}</span><div class="action-flex"><button class="btn btn-s" onclick="editKV('${c}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('${c}')"><i data-lucide="trash"></i>Delete</button></div></div>`).join('');
    document.getElementById('list-group-configs').innerHTML = filter(data.groupConfigs);
    document.getElementById('list-node-configs').innerHTML = filter(data.nodeConfigs);
    document.getElementById('list-cert-configs').innerHTML = filter(data.certConfigs);
    if (window.lucide) lucide.createIcons();
}

function renderIPs(data) {
    const ipBody = document.querySelector('#table-ips tbody');
    if (!ipBody) return;
    ipBody.innerHTML = Object.keys(data.ips || {}).filter(node => !currentSearch || node.toLowerCase().includes(currentSearch) || (data.ips[node] || '').toLowerCase().includes(currentSearch)).map(node => `<tr>
        <td style="font-weight:600; padding-left: 1.5rem;">ip:${node}</td>
        <td class="copyable" onclick="copyToClipboard('${data.ips[node]}')"><div style="opacity: 0.8; font-size: 0.85rem;">${data.ips[node]}</div></td>
        <td style="text-align: right; padding-right: 1.5rem;"><div class="action-flex" style="justify-content: flex-end;"><button class="btn btn-s" onclick="editIP('${node}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteIP('${node}')"><i data-lucide="trash"></i>Delete</button></div></td>
    </tr>`).join('');
    if (window.lucide) lucide.createIcons();
}

function renderCloudInit(data) {
    const cloudBody = document.querySelector('#table-cloud tbody');
    if (!cloudBody) return;
    cloudBody.innerHTML = (data.cloudConfigs || []).filter(c => !currentSearch || c.toLowerCase().includes(currentSearch)).map(c => `<tr>
        <td style="font-weight:600; padding-left: 1.5rem;">${c}</td>
        <td><span class="badge badge-accent">KV Storage</span></td>
        <td style="text-align: right; padding-right: 1.5rem;"><div class="action-flex" style="justify-content: flex-end;"><button class="btn btn-s" onclick="editKV('${c}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('${c}')"><i data-lucide="trash"></i>Delete</button></div></td>
    </tr>`).join('');
    if (window.lucide) lucide.createIcons();
}

async function refreshStatusDots() {
    if (!lastData || !lastData.registry) return;
    const hostnames = Object.keys(lastData.registry);
    const batchSize = 40;
    const total = hostnames.length;

    const promises = [];
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
                if (document.getElementById('section-logs').classList.contains('active')) fetchSystemLogs();
            }
            previousStatuses[node] = newStatus;
        }

        document.querySelectorAll('.status-dot').forEach(dot => {
            const node = dot.getAttribute('data-node');
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

async function fetchSystemLogs(append = false) {
    const state = logState.system;
    if (state.loading) return;
    if (append && !state.hasMore) return;

    const container = document.getElementById('system-logs');
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

        logs.forEach(l => {
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

function handleSystemDateChange(val) {
    if (!val) { resetSystemLogs(); return; }
    logState.system.date = val;

    // Just always jump to the date to ensure fresh results and context
    fetchSystemLogs(false);
}

function resetSystemLogs() {
    const today = new Date().toLocaleDateString('en-CA');
    logState.system.date = today;
    const input = document.getElementById('system-log-date');
    if (input) input.value = today;
    fetchSystemLogs(false);
}

function handleLogScroll(e, type) {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
        if (type === 'system' && logState.system.hasMore) {
            fetchSystemLogs(true);
        } else if (type === 'live' && logState.live.hasMore) {
            fetchLiveNodeLogs(logState.live.hostname, true);
        }
    }
}

async function viewNodeLogs(h) {
    showSection('logs');
    logState.live.hostname = h;
    logState.live.offset = 0;
    logState.live.hasMore = true;
    logState.live.lastDateStr = '';
    document.getElementById('btn-reset-live').style.display = 'block';
    fetchLiveNodeLogs(h, false);
}

function resetLiveLogs() {
    logState.live.hostname = '';
    document.getElementById('current-log-node').innerText = 'None';
    document.getElementById('live-logs').innerHTML = '<div style="opacity: 0.5;">Select a node to view live logs...</div>';
    document.getElementById('btn-reset-live').style.display = 'none';
}

async function fetchLiveNodeLogs(h, append = false) {
    const state = logState.live;
    if (state.loading) return;
    if (append && !state.hasMore) return;

    const container = document.getElementById('live-logs');
    document.getElementById('current-log-node').innerText = h;

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

        logs.forEach(l => {
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
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        if (!append) container.innerHTML = '<div style="color:var(--danger)">Failed to fetch node history.</div>';
    } finally {
        state.loading = false;
    }
}

async function fetchRawShellLogs(h) {
    const container = document.getElementById('live-logs');
    container.innerHTML = '<div style="opacity:0.5">Fetching raw shell logs from ' + h + '...</div>';
    try {
        const res = await fetch(`/api/node-proxy?token=${TOKEN}&hostname=${h}&endpoint=logs`);
        const data = await res.text();
        let html = `<div style="margin-bottom:1rem;"><button class="btn btn-s" onclick="viewNodeLogs('${h}')"><i data-lucide="arrow-left"></i> Back to History</button></div>`;
        html += `<div style="background:#000; color:#0f0; padding:1.5rem; border-radius:1rem; border:1px solid var(--glass-border); line-height:1.5; font-size:0.85rem; font-family:\'Courier New\', Courier, monospace; min-height:400px; max-height:600px; overflow-y:auto; white-space:pre-wrap;">${data || 'No shell logs returned.'}</div>`;
        container.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        container.innerHTML = '<div style="color:var(--danger)">Failed to fetch raw shell logs.</div>';
    }
}

function toggleDropdown(event) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const content = btn.nextElementSibling;
    const isShow = content.classList.contains('show');

    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));

    if (!isShow) {
        // Smart positioning: check if there's space below
        const rect = btn.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const spaceBelow = windowHeight - rect.bottom;
        const dropdownHeight = 200; // estimated

        if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
            content.classList.add('drop-up');
        } else {
            content.classList.remove('drop-up');
        }

        content.classList.add('show');
    }
}

window.onclick = function (event) {
    if (!event.target.matches('.dropdown-trigger')) document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.table-container').forEach(c => c.addEventListener('scroll', () => {
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
    }));
});

async function copyToClipboard(text) { try { await navigator.clipboard.writeText(text); showToast("Copied!"); } catch (err) { } }
function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg; t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 2000);
}

async function fetchNodeInfo(h) {
    document.getElementById('loader').style.display = 'block';
    try {
        const res = await fetch(`/api/node-proxy?token=${TOKEN}&hostname=${h}&endpoint=nodeinfo`);
        const raw = await res.text();
        let display = raw;
        try { display = JSON.stringify(JSON.parse(raw), null, 4); } catch (e) { }
        showModal({ title: `Node Info: ${h}`, content: display, mode: 'info' });
    } catch (e) { showModal({ title: 'Error', message: 'Failed to fetch node info.', mode: 'alert' }); }
    document.getElementById('loader').style.display = 'none';
}

async function runNodeAction(h, a) {
    const executeAction = async () => {
        document.getElementById('loader').style.display = 'block';
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
        document.getElementById('loader').style.display = 'none';
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

async function updateNodeGroup(h, g) {
    document.getElementById('loader').style.display = 'block';
    const updated = groupsData.map(item => {
        let nodes = (item.listnode || "").split(',').map(s => s.trim()).filter(s => s && s !== h);
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

async function deleteFromRegistry(h) {
    showModal({
        title: 'Delete Node',
        message: `Are you sure you want to delete ${h} from the registry?`,
        mode: 'confirm',
        onConfirm: async () => {
            document.getElementById('loader').style.display = 'block';
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
                const updatedGroups = (data.groups || []).map(item => {
                    let nodes = (item.listnode || "").split(',').map(s => s.trim()).filter(s => s && s !== h);
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
            document.getElementById('loader').style.display = 'none';
        }
    });
}

async function editKV(k) {
    currentKey = k; isNew = false;
    showModal({ title: 'Edit ' + k, mode: 'editor' });
    document.getElementById('loader').style.display = 'block';
    try {
        const res = await fetch(`/api/get-kv?token=${TOKEN}&key=${k}`);
        document.getElementById('editor').value = await res.text();
    } catch (e) { }
    document.getElementById('loader').style.display = 'none';
}

function openCreateModal() {
    isNew = true;
    const currentSection = document.querySelector('.section.active')?.id || 'section-nodes';
    showModal({ title: 'Create New Configuration', mode: 'editor' });
    document.getElementById('modal-key-input').style.display = 'block';

    let defaultKey = '';
    if (currentSection === 'section-ip') defaultKey = 'ip:';
    else if (currentSection === 'section-cloud') defaultKey = 'cloud:';
    document.getElementById('new-key-name').value = defaultKey;
    document.getElementById('editor').value = '{}';
}

async function editIP(node) {
    currentKey = 'ip:' + node; isNew = false;
    document.getElementById('modal-title').innerText = 'Edit IP: ' + node;
    document.getElementById('modal-key-input').style.display = 'none';
    document.getElementById('editor-container').style.display = 'block';
    document.getElementById('info-container').style.display = 'none';
    document.getElementById('modal-save-btn').style.display = 'block';
    document.getElementById('loader').style.display = 'block';
    try {
        const res = await fetch(`/api/data?token=${TOKEN}`);
        const data = await res.json();
        document.getElementById('editor').value = data.ips[node] || "";
        document.getElementById('modal').style.display = 'flex';
    } catch (e) { }
    document.getElementById('loader').style.display = 'none';
}

async function saveData() {
    const currentSection = document.querySelector('.section.active')?.id || 'section-nodes';
    const key = isNew ? document.getElementById('new-key-name').value : currentKey;
    const val = document.getElementById('editor').value;
    if (!key) return showModal({ title: 'Input Required', message: 'Key name is required.', mode: 'alert' });
    document.getElementById('loader').style.display = 'block';
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
    document.getElementById('loader').style.display = 'none';
}

async function deleteIP(node) {
    showModal({
        title: 'Delete IP',
        message: `Delete ip:${node}?`,
        mode: 'confirm',
        onConfirm: async () => {
            document.getElementById('loader').style.display = 'block';
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
            document.getElementById('loader').style.display = 'none';
        }
    });
}

async function deleteKV(key) {
    showModal({
        title: 'Delete Key',
        message: `Delete key "${key}"?`,
        mode: 'confirm',
        onConfirm: async () => {
            document.getElementById('loader').style.display = 'block';
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
            document.getElementById('loader').style.display = 'none';
        }
    });
}

function showModal({ title, message, content, mode, onConfirm }) {
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

    if (mode === 'confirm' && onConfirm) {
        document.getElementById('modal-confirm-action-btn').onclick = () => {
            onConfirm();
            closeModal();
        };
    }

    if (mode === 'info' && content) {
        document.getElementById('info-content').innerText = content;
    }
    document.getElementById('modal').style.display = 'flex';
}

let xterm = null;
let xtermFit = null;
let termWs = null;
let currentTerminalNode = '';
let currentTerminalUrl = '';

function updateUIStatus(newStatus) {
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

function openTerminal(h, hostUrl) {
    currentTerminalNode = h;
    currentTerminalUrl = hostUrl;
    showSection('terminal');

    const terminalTitle = document.getElementById('terminal-section-title');
    terminalTitle.innerText = h;

    const originUrl = hostUrl.startsWith('http') ? hostUrl : "https://8877-" + hostUrl;
    const newTabBtn = document.getElementById('terminal-new-tab-btn');
    if (newTabBtn) newTabBtn.dataset.url = originUrl;

    updateUIStatus('connecting');
    initXterm(h);
}

function initXterm(h) {
    if (termWs) { try { termWs.close(); } catch (e) { } }
    termWs = null;
    const container = document.getElementById('xterm-container');
    container.innerHTML = '';

    // @ts-ignore
    xterm = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontFamily: '"Ubuntu Mono", monospace',
        fontSize: 14,
        letterSpacing: 0.5,
        lineHeight: 1.2,
        allowProposedApi: true,
        theme: {
            background: 'rgba(0, 0, 0, 0)',
            foreground: '#e6edf3',
            cursor: '#60a5fa',
            selection: 'rgba(96, 165, 250, 0.3)',
            black: '#484f58',
            red: '#ff7b72',
            green: '#4ade80',
            yellow: '#fbbf24',
            blue: '#60a5fa',
            magenta: '#c084fc',
            cyan: '#22d3ee',
            white: '#f3f4f6',
            brightBlack: '#6b7280',
            brightRed: '#f87171',
            brightGreen: '#4ade80',
            brightYellow: '#fbbf24',
            brightBlue: '#60a5fa',
            brightMagenta: '#c084fc',
            brightCyan: '#22d3ee',
            brightWhite: '#ffffff'
        }
    }, {
        allowTransparency: true,
    });

    // @ts-ignore
    xtermFit = new FitAddon.FitAddon();
    xterm.loadAddon(xtermFit);
    xterm.open(container);

    // Fit terminal after load
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

function connectWs(h) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + "//" + location.host + "/terminal-proxy/" + TOKEN + "/" + h + "/ws";

    // @ts-ignore
    termWs = new WebSocket(wsUrl, 'tty');
    termWs.binaryType = 'arraybuffer';

    const decoder = new TextDecoder();

    termWs.onopen = () => {
        updateUIStatus('online');
        // Show VNX System Message in green
        xterm.write('\x1b[38;5;82m[Hệ thống] Kết nối thành công! Đang đồng bộ hóa...\x1b[0m\r\n');

        const initMsg = JSON.stringify({
            "AuthToken": "",
            "columns": xterm.cols || 100,
            "rows": xterm.rows || 30
        });
        termWs.send(initMsg);
    };

    termWs.onmessage = (ev) => {
        const processString = (msg) => {
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

    xterm.onData(data => {
        if (termWs && termWs.readyState === WebSocket.OPEN) {
            termWs.send('0' + data);
        }
    });

    xterm.onResize(size => {
        if (termWs && termWs.readyState === WebSocket.OPEN) {
            termWs.send(JSON.stringify({ columns: size.cols, rows: size.rows }));
        }
    });

    window.addEventListener('resize', () => xtermFit.fit());
}

function resetTerminal() {
    if (currentTerminalNode) initXterm(currentTerminalNode);
}

function closeModal() { document.getElementById('modal').style.display = 'none'; }
let autoRefreshInterval = null;
let countdown = 30;
let isLive = false;

function toggleAutoRefresh() {
    isLive = !isLive;
    const btn = document.getElementById('btn-live');
    const dot = document.getElementById('live-dot');
    const txt = document.getElementById('live-text');
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
    document.getElementById('live-text').innerText = "Live in " + countdown + "s";
}

// Initialize if token is present
if (TOKEN) {
    // Set initial date picker to today (local time)
    const today = new Date().toLocaleDateString('en-CA');
    const systemLogDateInput = document.getElementById('system-log-date');
    if (systemLogDateInput) systemLogDateInput.value = today;

    document.addEventListener('DOMContentLoaded', () => {
        showSection('nodes');
        refreshData();
    });
} else {
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('auth-warning').style.display = 'block';
    });
}
