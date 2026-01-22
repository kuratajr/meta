// @ts-nocheck
async function viewNodeLogs(h) {
    showSection('logs');
    document.getElementById('log-type-select').value = 'live';
    document.getElementById('log-host-filter').value = h;
    toggleLogView();
    refreshLogs();
}

function toggleLogView() {
    const type = document.getElementById('log-type-select').value;
    document.getElementById('logs-list-system').style.display = type === 'system' ? 'block' : 'none';
    document.getElementById('logs-list-live').style.display = type === 'live' ? 'block' : 'none';
    refreshLogs();
}

async function refreshLogs() {
    const type = document.getElementById('log-type-select').value;
    const host = document.getElementById('log-host-filter').value;
    const container = type === 'system' ? document.getElementById('logs-list-system') : document.getElementById('logs-list-live');
    container.innerHTML = '<div style="opacity: 0.5; padding: 2rem;">Fetching logs...</div>';
    try {
        let url = `/api/logs?token=${TOKEN}&offset=0&limit=100`;
        if (host) url += `&hostname=${host}`;
        const res = await fetch(`${url}&_=${Date.now()}`);
        const logs = await res.json();
        renderLogs(container, logs);
    } catch (e) { container.innerHTML = 'Error loading logs.'; }
}

function renderLogs(container, logs) {
    if (!logs.length) { container.innerHTML = '<div style="opacity: 0.5; padding: 2rem;">No logs found.</div>'; return; }
    let html = '';
    let lastDate = '';
    logs.forEach(l => {
        const d = new Date(l.time + " UTC");
        const dateStr = d.toLocaleDateString();
        if (dateStr !== lastDate) {
            html += `<div class="log-date-header">${dateStr}</div>`;
            lastDate = dateStr;
        }
        html += `<div style="font-family: monospace; font-size: 0.85rem; margin-bottom: 0.3rem; padding: 0.2rem 1rem; border-left: 2px solid var(--accent);">
            <span style="color: var(--text-dim);">[${d.toLocaleTimeString()}]</span> ${l.msg}
        </div>`;
    });
    container.innerHTML = html;
}
