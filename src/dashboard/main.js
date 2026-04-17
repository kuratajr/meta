import { FileBrowserClient } from './api-client.js';
import { FileExplorer } from './file-explorer.js';

const TOKEN = new URLSearchParams(window.location.search).get('token');
let currentKey = '';
let isNew = false;
let groupsData = [];
let lastData = null;
let currentSearch = '';
let nodeMetadata = {};
let previousStatuses = {};
let nodeStatuses = {}; 
let hubSocket = null;
let currentStatusFilter = 'all';
let offlineThresholdMinutes = 10;
let hubConfig = { url: '', secret: '' };

// File Manager global state
const explorer = new FileExplorer('file-list');
let fbClient = null;
let activeFmCredentials = { username: 'admin', password: 'admin' };
const FM_CREDENTIALS_KEY = 'meta_fm_credentials';

// Log states for pagination
let logState = {
    system: { offset: 0, date: new Date().toLocaleDateString('en-CA'), hostname: '', loading: false, hasMore: true, lastDateStr: '' },
    live: { offset: 0, date: '', hostname: '', loading: false, hasMore: true, lastDateStr: '' }
};

export function handleStatusFilter(val) {
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

export function showSection(id) {
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
    else if (id === 'gcp') sectionTitle = 'Google Cloud Workstations Auth';
    else if (id === 'logs') { sectionTitle = 'System Logs & Activity'; resetSystemLogs(); updateNodeDropdown(); }

    const titleEl = document.getElementById('section-title');
    if (titleEl) titleEl.innerText = sectionTitle;

    const btn = document.getElementById('btn-create');
    if (btn) btn.style.display = (id === 'templates' || id === 'configs' || id === 'global' || id === 'ip' || id === 'cloud') ? 'block' : 'none';

    const isTerminal = id === 'terminal';
    const isLogs = id === 'logs';
    const statsGrid = document.querySelector('.stats-grid');
    if (statsGrid) statsGrid.style.display = (isTerminal || isLogs) ? 'none' : 'grid';

    const liveIndicator = document.getElementById('live-indicator');
    if (liveIndicator) liveIndicator.style.display = 'flex';

    const btnLive = document.getElementById('btn-live');
    if (btnLive) btnLive.style.display = 'block';

    const refreshBtn = document.querySelector('.header')?.querySelector('button[onclick="refreshData()"]');
    if (refreshBtn) refreshBtn.style.display = 'block';

    // Conditional search visibility
    const hasTable = ['nodes', 'groups', 'ip', 'cloud', 'configs', 'gcp'].includes(id);
    const searchWrapper = document.getElementById('search-wrapper');
    if (searchWrapper) searchWrapper.style.display = hasTable ? 'block' : 'none';

    const statusFilterWrapper = document.getElementById('status-filter-wrapper');
    if (statusFilterWrapper) statusFilterWrapper.style.display = (id === 'nodes') ? 'inline-block' : 'none';

    // Toggle body class for logs/terminal section to prevent main scroll or allow flush right layout
    if (id === 'logs') {
        document.body.classList.add('logs-active');
    } else {
        document.body.classList.remove('logs-active');
    }

    if (id === 'terminal') {
        document.body.classList.add('terminal-active');
        const layout = document.getElementById('terminal-layout');
        if (layout && layout.classList.contains('show-files')) {
            document.body.classList.add('fm-active');
        }
    } else {
        document.body.classList.remove('terminal-active', 'fm-active');
    }

    if (id === 'configs') {
        document.body.classList.add('configs-active');
    } else {
        document.body.classList.remove('configs-active');
    }
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
        hubConfig = data.hub_config ? JSON.parse(data.hub_config) : { url: '', secret: '' };
        renderUI(data);
        initHubWebSocket();

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

export function handleSearch(val) {
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

function renderUI(data) {
    offlineThresholdMinutes = data.offline_threshold || 10;
    groupsData = data.groups || [];
    nodeMetadata = data.node_metadata || {};
    nodeStatuses = {};
    if (data.node_statuses) {
        data.node_statuses.forEach(s => { nodeStatuses[s.hostname] = s; });
    }
    renderGCPConfigs(data.gcp_configs || {});
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
    updateNodeDropdown();
    updateNodeTotals();

    const globalArea = document.getElementById('global-config-area');
    if (globalArea) {
        globalArea.innerHTML = data.hasGlobal ? `<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><span>global.json</span><div class="action-flex"><button class="btn btn-s" onclick="editKV('global')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('global')"><i data-lucide="trash"></i>Delete</button></div></div>` : 'None.';
    }

    renderSystemSettings(data);
    renderHubSettings();

    if (window.lucide) lucide.createIcons();
}

function initHubWebSocket() {
    if (hubSocket) hubSocket.close();
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws-hub`;
    
    hubSocket = new WebSocket(wsUrl);
    
    hubSocket.onopen = () => {
        updateHubStatusUI(true);
    };
    
    hubSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // Data is a map of hostname -> NodeInfo
            Object.keys(data).forEach(h => {
                nodeStatuses[h] = data[h];
            });
            updateNodeTotals();
            updateLiveTelemetry();
        } catch (e) {
            console.error("Hub WS Error:", e);
        }
    };
    
    hubSocket.onclose = () => {
        updateHubStatusUI(false);
        // Retry connection every 10s
        setTimeout(() => initHubWebSocket(), 10000);
    };
}

function updateHubStatusUI(connected) {
    const el = document.getElementById('hub-connection-status');
    if (!el) return;
    el.innerText = connected ? '● HUB CONNECTED' : '● HUB DISCONNECTED';
    el.style.color = connected ? 'var(--success)' : 'var(--danger)';
}

function updateLiveTelemetry() {
    // Efficiently update visible telemetry
    const activeSection = document.querySelector('.section.active');
    if (!activeSection || activeSection.id !== 'section-nodes') return;
    
    Object.keys(nodeStatuses).forEach(h => {
        const statsArea = document.querySelector(`tr[data-node="${h}"] .node-stats`);
        if (!statsArea) return;
        
        const info = nodeStatuses[h];
        if (info.last_seen) {
            const statusDot = document.querySelector(`tr[data-node="${h}"] .status-dot`);
            if (statusDot) statusDot.className = 'status-dot online';
        }
        
        // Update CPU, RAM, Disk, Uptime
        const cpuEl = statsArea.querySelector('span[title="CPU Usage"]');
        const ramEl = statsArea.querySelector('span[title="RAM Usage"]');
        const diskEl = statsArea.querySelector('span[title="Disk Usage"]');
        const uptimeEl = statsArea.querySelector('span[title="Uptime"]');
        
        if (cpuEl) cpuEl.innerHTML = `<i data-lucide="cpu" style="width:11px;height:11px"></i> ${Number(info.cpu).toFixed(2)}%`;
        if (ramEl) ramEl.innerHTML = `<i data-lucide="database" style="width:11px;height:11px"></i> ${Math.round(info.ram)}%`;
        if (diskEl) diskEl.innerHTML = `<i data-lucide="hard-drive" style="width:11px;height:11px"></i> ${Math.round(info.disk || 0)}%`;
        if (uptimeEl) uptimeEl.innerHTML = `<i data-lucide="clock" style="width:11px;height:11px"></i> ${formatUptime(info.uptime)}`;
    });
    if (window.lucide) lucide.createIcons();
}

function renderHubSettings() {
    const area = document.getElementById('hub-settings-area');
    if (!area) return;
    area.innerHTML = `
        <div class="card" style="margin-top: 1.5rem;">
            <h3 style="margin-bottom:1.5rem; opacity:0.8; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="share-2" style="width:1.2rem; height:1.2rem; color:var(--accent);"></i> Real-time WebSocket Hub</h3>
            <div style="display:flex; flex-direction:column; gap:1.2rem;">
                <div id="hub-connection-status" style="font-size:0.8rem; font-weight:700; color:var(--danger);">● HUB DISCONNECTED</div>
                
                <div class="form-group">
                    <label>Hub WebSocket URL</label>
                    <input type="text" id="input-hub-url" placeholder="ws://YOUR_HUB_IP:8080/stream" value="${hubConfig.url || ''}">
                </div>
                
                <div class="form-group">
                    <label>Hub Secret Key</label>
                    <input type="password" id="input-hub-secret" placeholder="Secret for Cloudflare connection" value="${hubConfig.secret || ''}">
                </div>
                
                <div style="display:flex; gap:1rem;">
                    <button class="btn btn-p" onclick="saveHubConfig()">Save & Connect</button>
                    <button class="btn btn-s" onclick="reconnectHub()">Force Reconnect</button>
                </div>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

export async function saveHubConfig() {
    const url = document.getElementById('input-hub-url').value;
    const secret = document.getElementById('input-hub-secret').value;
    
    hubConfig = { url, secret };
    await fetch(`/api/save?token=${TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'hub_config', value: JSON.stringify(hubConfig) })
    });
    
    await reconnectHub();
}

export async function reconnectHub() {
    const statusEl = document.getElementById('hub-connection-status');
    if (statusEl) {
        statusEl.innerText = '● CONNECTING...';
        statusEl.style.color = 'var(--accent)';
    }

    try {
        const resp = await fetch(`/api/reconnect-hub?token=${TOKEN}`);
        if (!resp.ok) {
            const errorText = await resp.text();
            if (statusEl) {
                statusEl.innerText = `● ERROR: ${errorText}`;
                statusEl.style.color = 'var(--danger)';
            }
            return;
        }
        
        // Wait a bit for the DO to establish the Hub connection then retry WS
        setTimeout(() => initHubWebSocket(), 2000);
    } catch (e) {
        if (statusEl) {
            statusEl.innerText = `● ERROR: ${e.message}`;
            statusEl.style.color = 'var(--danger)';
        }
    }
}

function renderSystemSettings(data) {
    const area = document.getElementById('system-settings-area');
    if (!area) return;
    area.innerHTML = `
        <div class="card" style="margin-top: 2rem;">
            <h3 style="margin-bottom:1.5rem; opacity:0.8; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="settings" style="width:1.2rem; height:1.2rem; color:var(--accent);"></i> System Settings</h3>
            <div style="display:flex; flex-direction:column; gap:1.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <div style="font-weight:600; font-size:0.95rem;">Offline Threshold</div>
                        <div style="font-size:0.8rem; opacity:0.6;">Minutes before a node is marked as offline.</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.8rem;">
                        <input type="number" id="input-offline-threshold" class="btn-s" style="width:80px; text-align:center; background:rgba(0,0,0,0.2); border:1px solid var(--glass-border); color:white; padding:0.5rem; border-radius:0.5rem;" value="${offlineThresholdMinutes}">
                        <button class="btn btn-p" onclick="updateOfflineThreshold()">Save</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

export async function updateOfflineThreshold() {
    const input = document.getElementById('input-offline-threshold');
    if (!input) return;
    const val = parseInt(input.value);
    if (isNaN(val) || val < 1) {
        alert("Please enter a valid number of minutes (minimum 1).");
        return;
    }

    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';

    try {
        const res = await fetch(`/api/save?token=${TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'offline_threshold', value: val.toString() })
        });
        const data = await res.json();
        if (data.success) {
            offlineThresholdMinutes = val;
            alert("Threshold updated successfully!");
            refreshData();
        } else {
            alert("Failed to update threshold: " + (data.error || "Unknown error"));
        }
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}
window.updateOfflineThreshold = updateOfflineThreshold;

function updateNodeTotals() {
    if (!lastData || !lastData.registry) return;
    const hostnames = Object.keys(lastData.registry);
    let online = 0;
    let offline = 0;

    hostnames.forEach(h => {
        const s = nodeStatuses[h];
        let isOnline = false;
        if (s && s.last_seen) {
            // Firefox fails on ISO strings with more than 3 fractional digits (nanoseconds)
            // We truncate to milliseconds (3 digits) or seconds (0 digits)
            const cleanLastSeen = s.last_seen.includes(' ') ? s.last_seen.replace(' ', 'T') + 'Z' : s.last_seen;
            const isoBase = cleanLastSeen.split('.')[0];
            const suffix = cleanLastSeen.includes('Z') ? 'Z' : (cleanLastSeen.match(/[+-]\d{2}:\d{2}$/) || [''])[0];
            const lastSeenDate = new Date(isoBase + suffix);

            isOnline = (lastSeenDate && !isNaN(lastSeenDate) && (new Date() - lastSeenDate < offlineThresholdMinutes * 60 * 1000));
        }
        if (isOnline) online++;
        else offline++;
        previousStatuses[h] = isOnline;
    });

    const onlineEl = document.getElementById('stat-online');
    const offlineEl = document.getElementById('stat-offline');

    if (onlineEl) onlineEl.innerText = online.toString();
    if (offlineEl) offlineEl.innerText = offline.toString();
}

const getGroupOf = (node) => {
    const g = groupsData.find(g => (g.listnode || "").split(',').map(s => s.trim()).includes(node));
    return g ? g.config : "None";
};

function formatUptime(str) {
    if (!str) return '';
    return str.replace('up ', '')
              .replace(/ days?,?/g, 'd')
              .replace(/ hours?,?/g, 'h')
              .replace(/ minutes?,?/g, 'm')
              .replace(/ seconds?,?/g, 's')
              .replace(/,/g, '');
}

function renderNodes(data) {
    const nBody = document.querySelector('#table-nodes tbody');
    if (!nBody) return;
    let html = '';
    for (const h in data.registry) {
        const regVal = data.registry[h];
        const currentGroup = getGroupOf(h);
        if (currentSearch && !h.toLowerCase().includes(currentSearch) && !regVal.toLowerCase().includes(currentSearch) && !currentGroup.toLowerCase().includes(currentSearch)) continue;

        let groupItems = `<div class="custom-dropdown-item" data-value="" data-node="${h}" onclick="selectCustomDropdownItem(event)">None</div>`;
        groupsData.forEach(g => { groupItems += `<div class="custom-dropdown-item${g.config === currentGroup ? ' selected' : ''}" data-value="${g.config}" data-node="${h}" onclick="selectCustomDropdownItem(event)">${g.config}</div>`; });

        const statusInfo = nodeStatuses[h];
        let isOnline = false;
        if (statusInfo && statusInfo.last_seen) {
            const cleanLastSeen = statusInfo.last_seen.includes(' ') ? statusInfo.last_seen.replace(' ', 'T') + 'Z' : statusInfo.last_seen;
            const isoBase = cleanLastSeen.split('.')[0];
            const suffix = cleanLastSeen.includes('Z') ? 'Z' : (cleanLastSeen.match(/[+-]\d{2}:\d{2}$/) || [''])[0];
            const lastSeenDate = new Date(isoBase + suffix);

            isOnline = (lastSeenDate && !isNaN(lastSeenDate) && (new Date() - lastSeenDate < offlineThresholdMinutes * 60 * 1000));
        }

        html += `<tr data-status="${isOnline ? 'online' : 'offline'}" data-node="${h}">
            <td class="cell-hostname">
                ${statusInfo && statusInfo.cpu !== null ? `
                    <div class="node-stats" style="font-size: 0.7rem; margin-bottom: 4px; display: flex; gap: 8px; flex-wrap: wrap; font-weight: 500;">
                        <span title="CPU Usage" style="color: #38bdf8; display: flex; align-items: center; gap: 3px;"><i data-lucide="cpu" style="width:11px;height:11px"></i> ${Number(statusInfo.cpu).toFixed(2)}%</span>
                        <span title="RAM Usage" style="color: #c084fc; display: flex; align-items: center; gap: 3px;"><i data-lucide="database" style="width:11px;height:11px"></i> ${Math.round(statusInfo.ram)}%</span>
                        <span title="Disk Usage" style="color: #fbbf24; display: flex; align-items: center; gap: 3px;"><i data-lucide="hard-drive" style="width:11px;height:11px"></i> ${Math.round(statusInfo.disk || 0)}%</span>
                        ${statusInfo.uptime ? `<span title="Uptime" style="color: #10b981; display: flex; align-items: center; gap: 3px;"><i data-lucide="clock" style="width:11px;height:11px"></i> ${formatUptime(statusInfo.uptime)}</span>` : ''}
                    </div>
                ` : ''}
                <div class="hostname-wrapper">
                    <span class="status-dot ${isOnline ? 'online' : 'offline'}" data-node="${h}"></span>
                    <span class="hostname-text">${h}</span>
                </div>
                ${nodeMetadata[h]?.token_expires ? `
                    <div class="token-expiry" style="color: ${(nodeMetadata[h].token_expires * 1000 - Date.now()) < 7200000 ? 'var(--danger)' : 'var(--success)'}; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 2px;">
                        <i data-lucide="key" style="width:11px; height:11px; opacity: 0.7;"></i>
                        <span style="font-size: 0.65rem; opacity: 0.8;">Expires: ${new Date(nodeMetadata[h].token_expires * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                ` : ''}
            </td>

            <td class="cell-cloudhost copyable" onclick="copyToClipboard('${regVal}', '${h}')" title="${regVal}">
                ${regVal}
            </td>
            <td style="text-align: center;">
                <div class="custom-dropdown" data-node="${h}">
                    <div class="custom-dropdown-trigger" onclick="toggleCustomDropdown(event)">
                        <span class="custom-dropdown-value">${currentGroup || 'None'}</span>
                        <i data-lucide="chevron-down"></i>
                    </div>
                    <div class="custom-dropdown-menu">
                        ${groupItems}
                    </div>
                </div>
            </td>
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
                                ${nodeMetadata[h]?.name ? `<div class="dropdown-item" onclick="copyToClipboard('${nodeMetadata[h].name}', '${h}')"><i data-lucide="clipboard"></i>Copy Name</div>` : ''}
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

    const groupConfigs = document.getElementById('list-group-configs');
    if (groupConfigs) groupConfigs.innerHTML = filter(data.groupConfigs);

    const nodeConfigs = document.getElementById('list-node-configs');
    if (nodeConfigs) nodeConfigs.innerHTML = filter(data.nodeConfigs);

    const certConfigs = document.getElementById('list-cert-configs');
    if (certConfigs) certConfigs.innerHTML = filter(data.certConfigs);

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
    // With Heartbeat model, statuses are updated via refreshData() -> renderUI()
    // No active batch-probing needed here.
    updateNodeTotals();
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

        logs.forEach((l) => {
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

export function handleSystemDateChange(val) {
    if (!val) { resetSystemLogs(); return; }
    logState.system.date = val;
    fetchSystemLogs(false);
}

export function resetSystemLogs() {
    const today = new Date().toLocaleDateString('en-CA');
    logState.system.date = today;
    const valueSpan = document.getElementById('system-date-value');
    if (valueSpan) {
        const date = new Date(today);
        valueSpan.textContent = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    }
    fetchSystemLogs(false);
}

export function handleLogScroll(e, type) {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
        if (type === 'system' && logState.system.hasMore) {
            fetchSystemLogs(true);
        } else if (type === 'live' && logState.live.hasMore) {
            fetchLiveNodeLogs(logState.live.hostname, true);
        }
    }
}

export async function viewNodeLogs(h) {
    showSection('logs');
    logState.live.hostname = h;
    logState.live.offset = 0;
    logState.live.hasMore = true;
    logState.live.lastDateStr = '';
    const resetBtn = document.getElementById('btn-reset-live');
    if (resetBtn) resetBtn.style.display = 'block';
    const valueSpan = document.getElementById('live-node-value');
    if (valueSpan) valueSpan.textContent = h;
    fetchLiveNodeLogs(h, false);
}

export function resetLiveLogs() {
    logState.live.hostname = '';
    const container = document.getElementById('live-logs');
    if (container) container.innerHTML = '<div style="opacity: 0.5;">Select a node to view live logs...</div>';
    const resetBtn = document.getElementById('btn-reset-live');
    if (resetBtn) resetBtn.style.display = 'none';
    const valueSpan = document.getElementById('live-node-value');
    if (valueSpan) valueSpan.textContent = 'Select a node...';
    const buttonContainer = document.getElementById('live-logs-button-container');
    if (buttonContainer) buttonContainer.style.display = 'none';
}

export function handleNodeSelect(nodeHostname) {
    if (!nodeHostname) {
        resetLiveLogs();
        return;
    }
    viewNodeLogs(nodeHostname);
}

export function updateNodeDropdown() {
    const menu = document.getElementById('live-node-menu');
    const valueSpan = document.getElementById('live-node-value');
    if (!menu || !lastData || !lastData.registry) return;

    const currentValue = logState.live.hostname || '';
    const nodes = Object.keys(lastData.registry).sort();

    let html = '';
    nodes.forEach(node => {
        const selected = node === currentValue ? ' selected' : '';
        html += `<div class="custom-dropdown-item${selected}" data-value="${node}" onclick="selectLiveNode('${node}')">${node}</div>`;
    });
    menu.innerHTML = html;
}

async function fetchLiveNodeLogs(h, append = false) {
    const state = logState.live;
    if (state.loading) return;
    if (append && !state.hasMore) return;

    const container = document.getElementById('live-logs');
    if (!container) return;

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

        logs.forEach((l) => {
            const dateObj = new Date(l.time + " UTC");
            const dateStr = dateObj.toLocaleDateString('en-GB');
            if (dateStr !== state.lastDateStr) {
                html += `<div class="log-date-header" style="margin-top:${state.lastDateStr ? '1.5rem' : '0'}">${dateStr}</div>`;
                state.lastDateStr = dateStr;
            }
            html += `<div class="log-entry" style="margin-bottom:0.4rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.2rem;"><span class="log-time" style="color:var(--accent); font-size:0.75rem; margin-right:0.8rem;">${dateObj.toLocaleTimeString()}</span>${l.msg}</div>`;
        });

        if (!append) {
            container.innerHTML = html || '<div style="opacity:0.5">No history found for this node.</div>';
            const buttonContainer = document.getElementById('live-logs-button-container');
            const btnViewRaw = document.getElementById('btn-view-raw-shell');
            if (buttonContainer && logs.length > 0) buttonContainer.style.display = 'block';
            if (btnViewRaw) btnViewRaw.setAttribute('onclick', `fetchRawShellLogs('${h}')`);
        } else {
            if (logs.length > 0) {
                const temp = document.createElement('div');
                temp.innerHTML = html;
                while (temp.firstChild) container.appendChild(temp.firstChild);
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

// Global exposure for event handlers in HTML
window.handleStatusFilter = handleStatusFilter;
window.toggleSidebar = toggleSidebar;
window.showSection = showSection;
window.refreshData = refreshData;
window.handleSearch = handleSearch;
window.handleSystemDateChange = handleSystemDateChange;
window.resetSystemLogs = resetSystemLogs;
window.handleLogScroll = handleLogScroll;
window.viewNodeLogs = viewNodeLogs;
window.resetLiveLogs = resetLiveLogs;

// Custom Date Picker
let datepickerYear = new Date().getFullYear();
let datepickerMonth = new Date().getMonth();
let selectedDate = null;

export function toggleDatePicker(event) {
    event.stopPropagation();
    const popup = document.getElementById('system-datepicker-popup');
    if (!popup) return;

    const isShow = popup.classList.contains('show');
    // Close all other popups
    document.querySelectorAll('.custom-datepicker-popup').forEach(p => p.classList.remove('show'));
    document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.classList.remove('show'));
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));

    if (!isShow) {
        renderDatePickerDays();
        popup.classList.add('show');
    }
}

export function navigateMonth(direction) {
    datepickerMonth += direction;
    if (datepickerMonth > 11) {
        datepickerMonth = 0;
        datepickerYear++;
    } else if (datepickerMonth < 0) {
        datepickerMonth = 11;
        datepickerYear--;
    }
    renderDatePickerDays();
}

export function renderDatePickerDays() {
    const daysContainer = document.getElementById('datepicker-days');
    const monthYearLabel = document.getElementById('datepicker-month-year');
    if (!daysContainer || !monthYearLabel) return;

    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    monthYearLabel.textContent = `${months[datepickerMonth]} ${datepickerYear}`;

    const firstDay = new Date(datepickerYear, datepickerMonth, 1).getDay();
    const daysInMonth = new Date(datepickerYear, datepickerMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(datepickerYear, datepickerMonth, 0).getDate();

    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA');

    let html = '';

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        html += `<button class="datepicker-day other-month" disabled>${day}</button>`;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${datepickerYear}-${String(datepickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedDate;
        let classes = 'datepicker-day';
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';
        html += `<button class="${classes}" onclick="selectDatePickerDay('${dateStr}')">${day}</button>`;
    }

    // Next month days
    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells > 35 ? 42 - totalCells : 35 - totalCells;
    for (let i = 1; i <= remaining; i++) {
        html += `<button class="datepicker-day other-month" disabled>${i}</button>`;
    }

    daysContainer.innerHTML = html;
}

export function selectDatePickerDay(dateStr) {
    selectedDate = dateStr;
    const valueSpan = document.getElementById('system-date-value');
    if (valueSpan) {
        const date = new Date(dateStr);
        valueSpan.textContent = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    }
    const popup = document.getElementById('system-datepicker-popup');
    if (popup) popup.classList.remove('show');

    handleSystemDateChange(dateStr);
}

export function clearDatePicker() {
    selectedDate = null;
    const valueSpan = document.getElementById('system-date-value');
    if (valueSpan) valueSpan.textContent = 'Select date...';
    const popup = document.getElementById('system-datepicker-popup');
    if (popup) popup.classList.remove('show');

    resetSystemLogs();
}

window.toggleDatePicker = toggleDatePicker;
window.navigateMonth = navigateMonth;
window.selectDatePickerDay = selectDatePickerDay;
window.clearDatePicker = clearDatePicker;


export async function fetchRawShellLogs(h) {
    const container = document.getElementById('live-logs');
    if (!container) return;
    container.innerHTML = '<div style="opacity:0.5">Fetching raw shell logs from ' + h + '...</div>';
    try {
        const res = await fetch(`/api/node-proxy?token=${TOKEN}&hostname=${h}&endpoint=logs`);
        const data = await res.text();
        let html = `<div style="margin-bottom:1rem;"><button class="btn btn-s" onclick="viewNodeLogs('${h}')"><i data-lucide="arrow-left"></i> Back to History</button></div>`;
        html += `<div style="color:#0f0; line-height:1.5; font-size:0.85rem; font-family:'Courier New', Courier, monospace; white-space:pre-wrap;">${data || 'No shell logs returned.'}</div>`;
        container.innerHTML = html;
        const buttonContainer = document.getElementById('live-logs-button-container');
        if (buttonContainer) buttonContainer.style.display = 'none';
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        container.innerHTML = '<div style="color:var(--danger)">Failed to fetch raw shell logs.</div>';
    }
}

export function toggleDropdown(event) {
    event.stopPropagation();
    const trigger = event.currentTarget || event.target.closest('.dropdown-trigger') || event.target.closest('.terminal-title-group');
    if (!trigger) return;
    const dropdown = trigger.classList.contains('dropdown') ? trigger : trigger.closest('.dropdown');
    if (!dropdown) return;
    const content = dropdown.querySelector('.dropdown-content');
    if (!content) return;

    const isShow = content.classList.contains('show');
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));

    if (!isShow) {
        const rect = trigger.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const spaceBelow = windowHeight - rect.bottom;
        const dropdownHeight = 250;

        if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
            content.classList.add('drop-up');
        } else {
            content.classList.remove('drop-up');
        }

        content.classList.add('show');
        if (dropdown.id === 'terminal-node-switcher' && typeof renderNodeSwitcher === 'function') {
            renderNodeSwitcher();
        }
    }
}

// Custom dropdown for group selection
export function toggleCustomDropdown(event) {
    event.stopPropagation();
    const trigger = event.currentTarget;
    const dropdown = trigger.closest('.custom-dropdown');
    if (!dropdown) return;
    const menu = dropdown.querySelector('.custom-dropdown-menu');
    if (!menu) return;

    const isShow = menu.classList.contains('show');
    // Close all other dropdowns
    document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.classList.remove('show'));
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));

    if (!isShow) {
        menu.classList.add('show');
    }
}

export function selectCustomDropdownItem(event) {
    const item = event.target.closest('.custom-dropdown-item');
    if (!item) return;

    const dropdown = item.closest('.custom-dropdown');
    const value = item.getAttribute('data-value');
    const node = item.getAttribute('data-node');
    const valueSpan = dropdown.querySelector('.custom-dropdown-value');
    const menu = dropdown.querySelector('.custom-dropdown-menu');

    // Update display
    valueSpan.textContent = value || 'None';

    // Mark selected
    dropdown.querySelectorAll('.custom-dropdown-item').forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');

    // Close menu
    menu.classList.remove('show');

    // Update node group
    updateNodeGroup(node, value);
}

window.toggleCustomDropdown = toggleCustomDropdown;
window.selectCustomDropdownItem = selectCustomDropdownItem;

// Custom dropdown for Live Node selection
export function toggleNodeDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('live-node-dropdown');
    if (!dropdown) return;
    const menu = dropdown.querySelector('.custom-dropdown-menu');
    if (!menu) return;

    const isShow = menu.classList.contains('show');
    // Close all other dropdowns
    document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.classList.remove('show'));
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));

    if (!isShow) {
        menu.classList.add('show');
    }
}

export function selectLiveNode(nodeHostname) {
    const valueSpan = document.getElementById('live-node-value');
    const menu = document.getElementById('live-node-menu');

    // Update display
    if (valueSpan) valueSpan.textContent = nodeHostname || 'Select a node...';

    // Mark selected
    if (menu) {
        menu.querySelectorAll('.custom-dropdown-item').forEach(i => i.classList.remove('selected'));
        const item = menu.querySelector(`[data-value="${nodeHostname}"]`);
        if (item) item.classList.add('selected');
        menu.classList.remove('show');
    }

    // Handle node selection
    handleNodeSelect(nodeHostname);
}

window.toggleNodeDropdown = toggleNodeDropdown;
window.selectLiveNode = selectLiveNode;

window.onclick = function (event) {
    if (!event.target.matches('.dropdown-trigger') && !event.target.closest('.custom-dropdown-trigger') && !event.target.closest('.custom-datepicker-trigger') && !event.target.closest('.custom-datepicker-popup')) {
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
        document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.classList.remove('show'));
        document.querySelectorAll('.custom-datepicker-popup').forEach(p => p.classList.remove('show'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.table-container').forEach(c => c.addEventListener('scroll', () => {
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
    }));
});

export async function copyToClipboard(text, node) {
    let finalPayload = text;
    if (node && nodeMetadata[node]?.token) {
        const token = nodeMetadata[node].token;
        // Only append token if the text looks like a URL or hostname
        if (typeof text === 'string' && (text.includes('.') || text.includes('://'))) {
            const separator = text.includes('?') ? '&' : '?';
            finalPayload = `${text}${separator}_workstationAccessToken=${token}`;
        }
    }
    try {
        await navigator.clipboard.writeText(finalPayload);
        showToast(node && nodeMetadata[node]?.token ? "Copied with Token!" : "Copied!");
    } catch (err) { }
}


function showToast(msg) {
    const t = document.getElementById('toast');
    if (t) {
        t.innerText = msg; t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 2000);
    }
}

export async function fetchNodeInfo(h) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';
    try {
        const res = await fetch(`/api/node-proxy?token=${TOKEN}&hostname=${h}&endpoint=nodeinfo`);
        const raw = await res.text();
        let display = raw;
        try { display = JSON.stringify(JSON.parse(raw), null, 4); } catch (e) { }

        // Mở rộng thông tin với Metadata nếu có
        const meta = nodeMetadata[h];
        let content = display;
        if (meta && meta.name) {
            content = `Resource Name: ${meta.name}\n` +
                `Last Registered: ${meta.updated_at || 'Unknown'}\n\n` +
                `--- Node Details ---\n` +
                display;
        }

        showModal({ title: `Node Info: ${h}`, content: content, mode: 'info' });
    } catch (e) { showModal({ title: 'Error', message: 'Failed to fetch node info.', mode: 'alert' }); }
    if (loader) loader.style.display = 'none';
}

export async function runNodeAction(h, a) {
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

export async function updateNodeGroup(h, g) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';
    const updated = groupsData.map((item) => {
        let nodes = (item.listnode || "").split(',').map((s) => s.trim()).filter((s) => s && s !== h);
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

export async function deleteFromRegistry(h) {
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

                const meta = data.node_metadata || {};
                delete meta[h];

                await Promise.all([
                    fetch(`/api/save?token=${TOKEN}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: 'registry', value: JSON.stringify(registry, null, 4) })
                    }),
                    fetch(`/api/save?token=${TOKEN}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: 'node_metadata', value: JSON.stringify(meta, null, 4) })
                    })
                ]);
                const updatedGroups = (data.groups || []).map((item) => {
                    let nodes = (item.listnode || "").split(',').map((s) => s.trim()).filter((s) => s && s !== h);
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

export async function editKV(k) {
    currentKey = k; isNew = false;
    showModal({ title: 'Edit ' + k, mode: 'editor' });
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';
    try {
        const res = await fetch(`/api/get-kv?token=${TOKEN}&key=${k}`);
        const editor = document.getElementById('editor');
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

    const keyNameInput = document.getElementById('new-key-name');
    if (keyNameInput) keyNameInput.value = defaultKey;

    const editor = document.getElementById('editor');
    if (editor) editor.value = '{}';
}

export async function editIP(node) {
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
        const editor = document.getElementById('editor');
        if (editor) editor.value = data.ips[node] || "";
        const modal = document.getElementById('modal');
        if (modal) modal.style.display = 'flex';
    } catch (e) { }
    if (loader) loader.style.display = 'none';
}

export async function saveData() {
    const activeSection = document.querySelector('.section.active');
    const currentSection = activeSection ? activeSection.id : '';
    const keyNameInput = document.getElementById('new-key-name');
    const key = isNew ? keyNameInput.value : currentKey;
    const editor = document.getElementById('editor');
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

export async function deleteIP(node) {
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

export async function deleteKV(key) {
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

function showModal({ title, message, content, mode, onConfirm }) {
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

window.fetchRawShellLogs = fetchRawShellLogs;
window.toggleDropdown = toggleDropdown;
window.copyToClipboard = copyToClipboard;
window.fetchNodeInfo = fetchNodeInfo;
window.runNodeAction = runNodeAction;
window.updateNodeGroup = updateNodeGroup;
window.deleteFromRegistry = deleteFromRegistry;
window.editKV = editKV;
export async function openMasterSettings() {
    const res = await fetch(`/api/get-master-creds?token=${TOKEN}`);
    const creds = res.ok ? await res.json() : {};
    
    showModal({
        title: 'Master OAuth2 Settings',
        message: 'Configure your Google Cloud Project Client ID and Client Secret. These are used to authorize accounts.',
        mode: 'editor'
    });
    
    const editor = document.getElementById('editor');
    if (editor) {
        editor.value = JSON.stringify(creds, null, 2);
        editor.placeholder = '{ "client_id": "...", "client_secret": "..." }';
    }

    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
        saveBtn.innerText = 'Save Master Settings';
        saveBtn.onclick = async () => {
            try {
                const updated = JSON.parse(editor.value);
                if (!updated.client_id || !updated.client_secret) throw new Error("Missing Client ID or Secret");
                
                const resp = await fetch(`/api/save-master-creds?token=${TOKEN}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updated)
                });
                if (resp.ok) {
                    showToast("Master settings saved!");
                    closeModal();
                } else {
                    alert("Failed to save master settings.");
                }
            } catch (e) {
                alert("Invalid JSON: " + e.message);
            }
        };
    }
}

export async function loginWithGoogle() {
    try {
        const res = await fetch(`/api/google-auth-url?token=${TOKEN}`);
        if (!res.ok) {
            const txt = await res.text();
            if (txt.includes("Master Settings Missing")) {
                showToast("Please configure Master Settings first!", 5000);
                openMasterSettings();
            } else {
                throw new Error(txt);
            }
            return;
        }
        const { url } = await res.json();
        const width = 500, height = 600;
        const left = (window.innerWidth / 2) - (width / 2);
        const top = (window.innerHeight / 2) - (height / 2);
        window.open(url, 'google-login', `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`);
    } catch (e) {
        alert("Error starting login flow: " + e.message);
    }
}

function renderGCPConfigs(accounts) {
    const tbody = document.querySelector('#table-gcp tbody');
    if (!tbody) return;

    let html = '';
    // accounts is now an array
    const accList = Array.isArray(accounts) ? accounts : [];

    accList.forEach(acc => {
        const dateStr = acc.added_at ? new Date(acc.added_at).toLocaleString() : 'N/A';
        html += `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.8rem;">
                        <i data-lucide="user" style="width: 16px; height: 16px; opacity: 0.6;"></i>
                        <span style="font-weight: 500;">${acc.email}</span>
                    </div>
                </td>
                <td><span style="opacity:0.6; font-size:0.85rem;">${dateStr}</span></td>
                <td style="text-align: center;">
                    <button class="btn btn-danger btn-s" onclick="deleteOAuthAccount('${acc.email}')">
                        <i data-lucide="trash-2"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    });

    if (accList.length === 0) {
        html = '<tr><td colspan="3" style="text-align:center; opacity:0.5; padding: 2rem;">No authorized Google accounts.</td></tr>';
    }
    tbody.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

export async function deleteOAuthAccount(email) {
    showModal({
        title: 'Remove Account',
        message: `Are you sure you want to remove access for "${email}"?`,
        mode: 'confirm',
        onConfirm: async () => {
            const loader = document.getElementById('loader');
            if (loader) loader.style.display = 'block';
            try {
                const res = await fetch(`/api/delete-oauth-account?token=${TOKEN}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                if (res.ok) {
                    showToast("Account removed!");
                    refreshData();
                }
            } catch (e) { }
            if (loader) loader.style.display = 'none';
        }
    });
}

export async function initAllTokens() {
    showToast("Initializing all node tokens...", 5000);
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';
    try {
        const res = await fetch(`/api/init-all-tokens?token=${TOKEN}`, { method: 'POST' });
        const data = await res.json();
        if (data.success_total !== undefined) {
            let msg = `Done! Success: ${data.success_total}, Failed: ${data.failed}, Skipped: ${data.skipped}`;
            if (data.failed > 0 && data.errors && data.errors.length > 0) {
                showModal({
                    title: 'Initialization Results',
                    message: msg,
                    content: data.errors.join('\n'),
                    mode: 'info'
                });
            } else {
                showToast(msg, 5000);
            }
            refreshData();
        } else {
            showToast("Initialization failed: " + (data.error || "Unknown error"), 5000);
        }
    } catch (e) {
        showToast("Error: " + e.message, 5000);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

window.openMasterSettings = openMasterSettings;
window.loginWithGoogle = loginWithGoogle;
window.deleteOAuthAccount = deleteOAuthAccount;
window.initAllTokens = initAllTokens;
window.openCreateModal = openCreateModal;
window.editIP = editIP;
window.saveData = saveData;
window.deleteIP = deleteIP;
window.deleteKV = deleteKV;
window.closeModal = closeModal;


// Terminal and logic
let xterm = null;
let xtermFit = null;
let termWs = null;
let currentTerminalNode = '';
let currentTerminalUrl = '';

function showSystemMessage(message, type = 'success', autoHide = true) {
    const messageEl = document.getElementById('terminal-system-message');
    if (!messageEl) return;

    messageEl.textContent = message;
    messageEl.className = 'terminal-system-message ' + type;
    messageEl.style.display = 'block';

    // Chỉ tự ẩn nếu autoHide = true (chỉ cho success/online)
    if (autoHide) {
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 5000);
    }
    // Nếu autoHide = false (error/offline), hiển thị luôn, không tự ẩn
}

window.showSystemMessage = showSystemMessage;

function updateUIStatus(newStatus) {
    const wrapper = document.getElementById('terminal-wrapper');
    const statusBadge = document.getElementById('status-badge');
    const statusText = document.getElementById('status-text');
    if (!wrapper || !statusBadge || !statusText) return;

    wrapper.className = 'terminal-outer-wrapper ' + newStatus;
    statusBadge.className = 'status-badge ' + newStatus;

    switch (newStatus) {
        case 'connecting':
            statusText.innerText = 'Connecting...';
            break;
        case 'online':
            statusText.innerText = 'Online';
            // Online: hiển thị 2 giây rồi tự ẩn
            showSystemMessage('[System] Connection successful! Synchronizing...', 'success', true);
            break;
        case 'offline':
            statusText.innerText = 'Offline';
            // Offline: hiển thị luôn, không tự ẩn
            showSystemMessage('[System] Connection closed.', 'error', false);
            break;
        case 'error':
            statusText.innerText = 'Connection Error';
            // Error: hiển thị luôn, không tự ẩn
            showSystemMessage('[Error] Unable to connect to server.', 'error', false);
            break;
    }
}

export function openTerminal(h, hostUrl) {
    currentTerminalNode = h;
    currentTerminalUrl = hostUrl;
    showSection('terminal');

    // Close any open dropdowns (including node switcher)
    document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));

    const terminalTitle = document.getElementById('terminal-section-title');
    if (terminalTitle) terminalTitle.innerText = h;

    const originUrl = hostUrl.startsWith('http') ? hostUrl : "https://8877-" + hostUrl;
    const newTabBtn = document.getElementById('terminal-new-tab-btn');
    if (newTabBtn) {
        let finalUrl = originUrl;
        if (nodeMetadata[h]?.token) {
            const separator = finalUrl.includes('?') ? '&' : '?';
            finalUrl += `${separator}_workstationAccessToken=${nodeMetadata[h].token}`;
        }
        newTabBtn.dataset.url = finalUrl;
    }


    updateUIStatus('connecting');
    initXterm(h);
    renderNodeSwitcher();
}

function renderNodeSwitcher() {
    const list = document.querySelector('#terminal-node-list .dropdown-scroll-area');
    if (!list || !lastData || !lastData.registry) return;

    let html = '';
    for (const h in lastData.registry) {
        const url = lastData.registry[h];
        const isActive = h === currentTerminalNode;
        html += `
            <div class="dropdown-item ${isActive ? 'active' : ''}" onclick="openTerminal('${h}', '${url}')">
                <i data-lucide="server" style="width: 14px; height: 14px; opacity: 0.6;"></i>
                <span>${h}</span>
                ${isActive ? '<i data-lucide="check" style="width: 14px; height: 14px; margin-left: auto; color: var(--success);"></i>' : ''}
            </div>
        `;
    }
    list.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
}

// Ensure first render
document.addEventListener('DOMContentLoaded', () => {
    // Already existing logic can stay
});

function initXterm(h) {
    if (termWs) { try { termWs.close(); } catch (e) { } }
    termWs = null;
    const container = document.getElementById('xterm-container');
    if (container) container.innerHTML = '';

    xterm = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontFamily: '"Cascadia Code", "Source Code Pro", "Consolas", "JetBrains Mono", "Fira Code", "Monaco", monospace',
        fontSize: 14,
        letterSpacing: -0.5,
        lineHeight: 1.1,
        fastScrollModifier: 'alt',
        macOptionIsMeta: true,
        macOptionClickForcesSelection: false,
        rightClickSelectsWord: true,
        theme: {
            background: '#0a0a0f',
            foreground: '#a0a0a0',
            cursor: '#888888',
            selection: 'rgba(56, 139, 253, 0.4)',
            black: '#1a1a1a',
            red: '#cc6666',
            green: '#88aa88',
            yellow: '#ccaa66',
            blue: '#8888aa',
            magenta: '#aa88aa',
            cyan: '#88aaaa',
            white: '#aaaaaa',
            brightBlack: '#444444',
            brightRed: '#cc8888',
            brightGreen: '#aaccaa',
            brightYellow: '#ccbb88',
            brightBlue: '#9999bb',
            brightMagenta: '#bb99bb',
            brightCyan: '#99bbbb',
            brightWhite: '#ffffff',
        },
        allowTransparency: true,
        cols: 100,
        rows: 30
    });

    xtermFit = new FitAddon.FitAddon();
    xterm.loadAddon(xtermFit);
    xterm.open(container);

    // Dynamic resize handling
    const resizeObserver = new ResizeObserver(() => {
        try {
            if (xtermFit) xtermFit.fit();
        } catch (e) {
            console.warn("Fit failed during resize:", e);
        }
    });
    resizeObserver.observe(container);

    // Force apply font and initial fit
    setTimeout(() => {
        const applyFont = () => {
            const fontStack = '"Cascadia Code", "Source Code Pro", "Consolas", "JetBrains Mono", "Fira Code", "Monaco", monospace';
            const xtermEls = container.querySelectorAll('*');
            xtermEls.forEach(el => {
                if (el.style) {
                    el.style.setProperty('font-family', fontStack, 'important');
                    el.style.setProperty('font-weight', '400', 'important');
                    el.style.setProperty('letter-spacing', 'normal', 'important');
                    el.style.setProperty('-webkit-font-smoothing', 'antialiased', 'important');
                    el.style.setProperty('-moz-osx-font-smoothing', 'grayscale', 'important');
                    el.style.setProperty('text-rendering', 'geometricPrecision', 'important');
                }
            });
            if (container.style) {
                container.style.setProperty('font-family', fontStack, 'important');
            }
            try { xtermFit.fit(); } catch (e) { }
        };
        applyFont();
        setTimeout(applyFont, 100);
        setTimeout(applyFont, 300);
    }, 50);

    setTimeout(() => {
        try {
            xtermFit.fit();
            connectWs(h);
        } catch (e) {
            console.error("Initial fit error:", e);
            connectWs(h);
        }
    }, 200);
}

function connectWs(h) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + "//" + location.host + "/terminal-proxy/" + TOKEN + "/" + h + "/ws";

    termWs = new WebSocket(wsUrl, 'tty');
    termWs.binaryType = 'arraybuffer';

    const decoder = new TextDecoder();

    termWs.onopen = () => {
        updateUIStatus('online');
        // System message now shown in header bar only

        const initMsg = JSON.stringify({
            "AuthToken": "",
            "columns": xterm.cols || 100,
            "rows": xterm.rows || 30
        });
        termWs.send(initMsg);

        // Initialize File Manager
        initFileBrowser(h);
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
        // System message now shown in header bar only
        fbClient = null;
        explorer.disconnect();
    };

    termWs.onerror = (err) => {
        updateUIStatus('error');
        // System message now shown in header bar only
        console.error('WebSocket Error:', err);
    };

    xterm.onData((data) => {
        if (termWs && termWs.readyState === WebSocket.OPEN) {
            termWs.send('0' + data);
        }
    });

    xterm.onResize((size) => {
        if (termWs && termWs.readyState === WebSocket.OPEN) {
            termWs.send(JSON.stringify({ columns: size.cols, rows: size.rows }));
        }
    });

    window.addEventListener('resize', () => xtermFit.fit());
}

export function resetTerminal() {
    if (currentTerminalNode) initXterm(currentTerminalNode);
}

export function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
}

let autoRefreshInterval = null;
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
window.originalRefreshData = refreshData;
window.refreshData = async () => {
    await window.originalRefreshData();
    if (isLive) countdown = 30;
};

if (TOKEN) {
    const today = new Date().toLocaleDateString('en-CA');
    const systemLogDateInput = document.getElementById('system-log-date');
    if (systemLogDateInput) systemLogDateInput.value = today;

    showSection('nodes');
    refreshData();
} else {
    const authWarning = document.getElementById('auth-warning');
    if (authWarning) authWarning.style.display = 'block';
}

window.openTerminal = openTerminal;
window.resetTerminal = resetTerminal;
window.toggleAutoRefresh = toggleAutoRefresh;
window.closeModal = closeModal;
window.editIP = editIP;
window.editKV = editKV;
window.deleteIP = deleteIP;
window.deleteKV = deleteKV;
window.saveData = saveData;
window.openCreateModal = openCreateModal;
window.runNodeAction = runNodeAction;
window.fetchNodeInfo = fetchNodeInfo;
window.viewNodeLogs = viewNodeLogs;
window.deleteFromRegistry = deleteFromRegistry;
window.updateNodeGroup = updateNodeGroup;
window.copyToClipboard = copyToClipboard;
window.resetLiveLogs = resetLiveLogs;
window.resetSystemLogs = resetSystemLogs;
window.handleSystemDateChange = handleSystemDateChange;
window.handleLogScroll = handleLogScroll;
window.handleSearch = handleSearch;
window.toggleDropdown = toggleDropdown;
window.handleStatusFilter = handleStatusFilter;
window.toggleSidebar = toggleSidebar;
window.showSection = showSection;
window.handleNodeSelect = handleNodeSelect;

// --- File Manager Functions ---

function getFileManagerCredentials() {
    try {
        const raw = localStorage.getItem(FM_CREDENTIALS_KEY);
        if (raw) {
            const o = JSON.parse(raw);
            if (o && o.username && o.password) return o;
        }
    } catch (_) { }
    return { username: 'admin', password: 'admin', overwrite: false };
}

function setFileManagerCredentials(username, password, overwrite) {
    localStorage.setItem(FM_CREDENTIALS_KEY, JSON.stringify({ username, password, overwrite }));
}

async function initFileBrowser(hostname) {
    console.log(`[FM] Initializing for node: ${hostname}`);
    let username = null;
    let password = null;

    // 1. Try node-specific config first
    try {
        const res = await fetch(`/api/get-kv?token=${TOKEN}&key=node:${hostname}`);
        if (res.ok) {
            const configText = await res.text();
            try {
                const config = JSON.parse(configText);
                if (config.FILEU) {
                    username = config.FILEU;
                    console.log(`[FM] Found custom username in node config: ${username}`);
                }
                if (config.FILEP) {
                    password = config.FILEP;
                    console.log(`[FM] Found custom password in node config`);
                }
            } catch (jsonErr) {
                console.warn(`[FM] Node config for ${hostname} is not valid JSON.`);
            }
        }
    } catch (err) {
        console.error(`[FM] Error fetching node config:`, err);
    }

    // 2. Fallback to localStorage or defaults
    const stored = getFileManagerCredentials();
    if (!username) username = stored.username || 'admin';
    if (!password) password = stored.password || 'admin';

    console.log(`[FM] Attempting login for ${hostname} with user: ${username}`);
    activeFmCredentials = { username, password };

    const proxyBase = `${window.location.origin}/terminal-proxy/${TOKEN}/${hostname}`;
    fbClient = new FileBrowserClient(proxyBase);

    try {
        showSystemMessage(`Connecting to File Manager (${username})...`, 'success', true);
        await fbClient.login(username, password);
        explorer.setClient(fbClient);
        await explorer.loadPath('/');
        showSystemMessage(`File Manager connected as ${username}`, 'success', true);
    } catch (err) {
        console.error('[FM] Login Error:', err);
        showSystemMessage(`File Manager auth failed using ${username}.`, 'error', false);
    }
}

function getOverwriteSetting() {
    return getFileManagerCredentials().overwrite || false;
}

window.getOverwriteSetting = getOverwriteSetting;

// UI Handlers for File Manager
document.getElementById('toggle-filemanager-btn')?.addEventListener('click', () => {
    const layout = document.getElementById('terminal-layout');
    if (layout) {
        layout.classList.toggle('show-files');
        const isShown = layout.classList.contains('show-files');
        document.body.classList.toggle('fm-active', isShown);
    }
    if (xtermFit) xtermFit.fit();
});

document.getElementById('refresh-fm-btn')?.addEventListener('click', () => {
    explorer.loadPath(explorer.getCurrentPath());
});

document.getElementById('upload-btn')?.addEventListener('click', () => {
    document.getElementById('file-upload')?.click();
});

async function handleFileUpload(files) {
    if (!fbClient || !files || !files.length) return;
    const path = explorer.getCurrentPath();
    showSystemMessage(`Uploading ${files.length} file(s)...`, 'success', true);

    let ok = 0;
    for (const file of files) {
        try {
            const fullPath = (path === '/' ? '' : path) + '/' + file.name;
            const { overwrite } = getFileManagerCredentials();
            await fbClient.upload(fullPath, file, { override: overwrite });
            ok++;
        } catch (err) {
            console.error('Upload failed:', file.name, err);
        }
    }
    showSystemMessage(`Uploaded ${ok}/${files.length} files.`, ok === files.length ? 'success' : 'error', true);
    explorer.loadPath(path);
}

document.getElementById('file-upload')?.addEventListener('change', async (e) => {
    if (!e.target.files?.length) return;
    await handleFileUpload(Array.from(e.target.files));
    e.target.value = '';
});

// Drag and Drop support for File List
const fileListContainer = document.getElementById('file-list');
if (fileListContainer) {
    fileListContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileListContainer.classList.add('drag-over');
    });

    fileListContainer.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileListContainer.classList.add('drag-over');
    });

    fileListContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileListContainer.classList.remove('drag-over');
    });

    fileListContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileListContainer.classList.remove('drag-over');

        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            await handleFileUpload(Array.from(e.dataTransfer.files));
        }
    });
}

// Drag and Drop support for Terminal Body
const terminalBody = document.querySelector('.terminal-body-container');
if (terminalBody) {
    terminalBody.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        terminalBody.classList.add('drag-over');
    });

    terminalBody.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        terminalBody.classList.add('drag-over');
    });

    terminalBody.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        terminalBody.classList.remove('drag-over');
    });

    terminalBody.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        terminalBody.classList.remove('drag-over');

        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            await handleFileUpload(Array.from(e.dataTransfer.files));
        }
    });
}

// New Folder
const nfModal = document.getElementById('new-folder-modal');
const nfInput = document.getElementById('new-folder-input');
const nfPath = document.getElementById('new-folder-path');
let nfParent = '/';

function openNewFolderModal(parent) {
    nfParent = parent;
    if (nfPath) nfPath.textContent = parent;
    if (nfInput) nfInput.value = '';
    if (nfModal) nfModal.classList.add('active');
    nfInput?.focus();
}

document.getElementById('new-folder-btn')?.addEventListener('click', () => {
    if (!fbClient) return;
    explorer.createNewFolder();
});

// (Old Modal handlers removed as they are no longer used for inline creation)

// Context Menu Actions
let selectedFile = null;
const actionModal = document.getElementById('file-action-modal');

window.addEventListener('file-selected', (e) => {
    const { file, clientX, clientY } = e.detail;
    selectedFile = file;
    if (actionModal) {
        actionModal.classList.add('active');
        const content = document.getElementById('file-action-content');
        if (content) {
            content.style.left = `${Math.min(clientX, window.innerWidth - 200)}px`;
            content.style.top = `${Math.min(clientY, window.innerHeight - 280)}px`;
        }
        document.getElementById('file-action-title').textContent = file.name;
        document.getElementById('file-action-download').style.display = file.type === 'directory' ? 'none' : 'flex';
    }
});

document.getElementById('file-action-close')?.addEventListener('click', () => actionModal.classList.remove('active'));
document.getElementById('file-action-backdrop')?.addEventListener('click', () => actionModal.classList.remove('active'));

document.getElementById('file-action-download')?.addEventListener('click', async () => {
    if (!selectedFile || !fbClient) return;
    try {
        const buf = await fbClient.getRawBuffer(selectedFile.path);
        const blob = new Blob([buf]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFile.name;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        showSystemMessage('Download failed', 'error', true);
    }
    actionModal.classList.remove('active');
});

document.getElementById('file-action-copy')?.addEventListener('click', () => {
    if (selectedFile) {
        navigator.clipboard.writeText(selectedFile.path);
        showToast('Path copied!');
    }
    actionModal.classList.remove('active');
});

document.getElementById('file-action-rename')?.addEventListener('click', () => {
    if (selectedFile) {
        explorer.startRename(selectedFile);
    }
    actionModal.classList.remove('active');
});

document.getElementById('file-action-delete')?.addEventListener('click', () => {
    if (!selectedFile) return;
    document.getElementById('confirm-delete-message').textContent = `Delete "${selectedFile.name}"?`;
    document.getElementById('confirm-delete-modal').classList.add('active');
    actionModal.classList.remove('active');
});

document.getElementById('confirm-delete-cancel')?.addEventListener('click', () => document.getElementById('confirm-delete-modal').classList.remove('active'));
document.getElementById('confirm-delete-ok')?.addEventListener('click', async () => {
    if (!selectedFile || !fbClient) return;
    try {
        await fbClient.delete(selectedFile.path);
        explorer.loadPath(explorer.getCurrentPath());
    } catch (err) {
        showSystemMessage('Delete failed', 'error', true);
    }
    document.getElementById('confirm-delete-modal').classList.remove('active');
});

// Move / Copy To
const moveModal = document.getElementById('move-dest-modal');
const moveList = document.getElementById('move-dest-list');
let pickerPath = '/';
let pickerMode = 'move';

async function loadPickerDirs(path) {
    pickerPath = path;
    document.getElementById('move-dest-path').textContent = path;
    moveList.innerHTML = '<div style="padding:10px; opacity:0.5;">Loading...</div>';
    try {
        const res = await fbClient.listDir(path);
        const dirs = (res.items || []).filter(i => i.isDir || i.is_dir || i.IsDir || i.type === 'directory');
        moveList.innerHTML = '';

        if (path !== '/') {
            const up = document.createElement('div');
            up.className = 'move-dest-folder-item';
            up.textContent = '.. (Back)';
            up.onclick = () => {
                const parts = path.split('/').filter(Boolean);
                parts.pop();
                loadPickerDirs('/' + parts.join('/'));
            };
            moveList.appendChild(up);
        }

        dirs.forEach(d => {
            const el = document.createElement('div');
            el.className = 'move-dest-folder-item';
            el.textContent = d.name + ' /';
            el.onclick = () => loadPickerDirs((path === '/' ? '' : path) + '/' + d.name);
            moveList.appendChild(el);
        });
    } catch (e) {
        moveList.innerHTML = '<div style="color:var(--danger)">Error loading folders</div>';
    }
}

document.getElementById('file-action-move')?.addEventListener('click', () => {
    pickerMode = 'move';
    document.getElementById('move-dest-title').textContent = 'Move To';
    document.getElementById('move-dest-action-btn').textContent = 'Move Here';
    actionModal.classList.remove('active');
    moveModal.classList.add('active');
    loadPickerDirs(explorer.getCurrentPath());
});

document.getElementById('file-action-copy-to')?.addEventListener('click', () => {
    pickerMode = 'copy';
    document.getElementById('move-dest-title').textContent = 'Copy To';
    document.getElementById('move-dest-action-btn').textContent = 'Copy Here';
    actionModal.classList.remove('active');
    moveModal.classList.add('active');
    loadPickerDirs(explorer.getCurrentPath());
});

document.getElementById('move-dest-cancel')?.addEventListener('click', () => moveModal.classList.remove('active'));
document.getElementById('move-dest-action-btn')?.addEventListener('click', async () => {
    if (!selectedFile || !fbClient) return;
    const dest = (pickerPath === '/' ? '' : pickerPath) + '/' + selectedFile.name;
    const { overwrite } = getFileManagerCredentials();
    try {
        if (pickerMode === 'move') {
            await fbClient.rename(selectedFile.path, dest, { override: overwrite });
        } else {
            await fbClient.copy(selectedFile.path, dest, overwrite);
        }
        explorer.loadPath(explorer.getCurrentPath());
        moveModal.classList.remove('active');
    } catch (err) {
        showSystemMessage(`Action failed: ${err.message}`, 'error', false);
    }
});

// Settings Modal
const settingsFmModal = document.getElementById('fm-settings-modal');
document.getElementById('settings-fm-btn')?.addEventListener('click', () => {
    // Show active credentials (could be from node config)
    document.getElementById('fm-username').value = activeFmCredentials.username;
    document.getElementById('fm-password').value = activeFmCredentials.password;

    const { overwrite } = getFileManagerCredentials();
    document.getElementById('fm-overwrite').checked = !!overwrite;
    settingsFmModal.classList.add('active');
});

document.getElementById('fm-settings-cancel')?.addEventListener('click', () => settingsFmModal.classList.remove('active'));
document.getElementById('fm-settings-save')?.addEventListener('click', () => {
    const u = document.getElementById('fm-username').value.trim();
    const p = document.getElementById('fm-password').value;
    const o = document.getElementById('fm-overwrite').checked;
    setFileManagerCredentials(u, p, o);
    settingsFmModal.classList.remove('active');
    if (currentTerminalNode) initFileBrowser(currentTerminalNode);
});

window.handleNodeSelect = handleNodeSelect;
window.handleStatusFilter = handleStatusFilter;
window.toggleSidebar = toggleSidebar;
window.showSection = showSection;
window.refreshData = refreshData;
window.handleSearch = handleSearch;
window.saveHubConfig = saveHubConfig;
window.reconnectHub = reconnectHub;

