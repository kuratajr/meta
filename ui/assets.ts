export const STYLES_CONTENT = `@charset "UTF-8";
:root {
    --primary: #6366f1;
    --primary-glow: rgba(99, 102, 241, 0.4);
    --bg: #0f172a;
    --glass: rgba(30, 41, 59, 0.5);
    --glass-border: rgba(255, 255, 255, 0.1);
    --text: #f8fafc;
    --text-dim: #94a3b8;
    --success: #10b981;
    --danger: #ef4444;
    --accent: #c084fc;
    --glass-bg: rgba(255, 255, 255, 0.03);
    --status-online: #3fb950;
    --status-error: #da3633;
    --accent-blue: #58a6ff;
}

* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }

body {
    background: radial-gradient(circle at top right, #1e1b4b, #0f172a);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    overflow-x: hidden;
}

/* Sidebar */
aside {
    width: 280px;
    background: rgba(15, 23, 42, 0.95);
    border-right: 1px solid var(--glass-border);
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    position: fixed;
    height: 100vh;
    z-index: 10000;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.logo {
    font-size: 1.2rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    background: linear-gradient(to right, #818cf8, var(--accent));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 1rem;
}

.nav-item {
    padding: 0.8rem 1rem;
    border-radius: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text-dim);
    font-weight: 400;
    display: flex;
    align-items: center;
    gap: 0.7rem;
}
.nav-item:hover { background: rgba(255, 255, 255, 0.05); color: var(--text); }
.nav-item.active { background: var(--primary); color: white; box-shadow: 0 4px 15px var(--primary-glow); }
.nav-item i { width: 1rem; height: 1rem; }

/* Mobile Hamburger */
.mobile-toggle {
    display: none;
    cursor: pointer;
    z-index: 10001;
    background: var(--glass);
    border: 1px solid var(--glass-border);
    padding: 0.5rem;
    border-radius: 0.5rem;
    position: fixed;
    top: 1rem;
    left: 1rem;
}

/* Main Content */
main {
    margin-left: 280px;
    flex: 1;
    padding: 3rem;
    max-width: 1400px;
    transition: margin-left 0.3s ease;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 3rem;
    flex-wrap: wrap;
    gap: 1rem;
}

/* Grid & Cards */
.dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-bottom: 3rem;
}

.card {
    background: var(--glass);
    backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: 1.5rem;
    padding: 2rem;
    transition: all 0.3s;
    animation: fadeIn 0.5s ease-out;
}
.card:hover { transform: translateY(-5px); border-color: rgba(99, 102, 241, 0.3); }

.card-title { font-size: 0.9rem; color: var(--text-dim); margin-bottom: 1rem; font-weight: 500; }
.card-value { font-size: 2.5rem; font-weight: 600; }

.section { display: none; animation: fadeIn 0.4s ease-out; }
.section.active { display: block; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* Tables & Scrolling */
.table-container { 
    background: var(--glass); 
    border: 1px solid var(--glass-border); 
    border-radius: 1.5rem;
    max-height: calc(100vh - 400px);
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    position: relative;
}
.table-container::-webkit-scrollbar { display: none; }

table { width: 100%; border-collapse: collapse; text-align: left; }
th { position: sticky; top: 0; background: #1e293b; padding: 1.2rem 1.5rem; font-size: 0.85rem; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; z-index: 10; }
td { padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--glass-border); font-size: 0.9rem; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(255, 255, 255, 0.03); }

.status-badge { padding: 0.4rem 0.8rem; border-radius: 2rem; font-size: 0.75rem; font-weight: 600; }
.status-online { background: rgba(16, 185, 129, 0.1); color: var(--success); }
.status-offline { background: rgba(239, 68, 68, 0.1); color: var(--danger); }

.copyable { cursor: pointer; transition: color 0.2s; position: relative; }
.copyable:hover { color: var(--accent); text-decoration: underline; }

/* Search Filter */
.search-container {
    position: relative;
    display: none; /* Hidden by default */
    width: 280px;
}
.search-container.show { display: block; }
.search-container i {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-dim);
    width: 1rem;
    height: 1rem;
}
.search-container input {
    width: 100%;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--glass-border);
    border-radius: 1rem;
    padding: 0.6rem 1rem 0.6rem 2.8rem;
    color: white;
    font-size: 0.9rem;
    outline: none;
    transition: all 0.3s;
}
.search-container input:focus { border-color: var(--primary); background: rgba(0, 0, 0, 0.3); }

/* Status Dots */
.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 0.5rem;
    transition: all 0.3s;
}
.status-dot.online {
    background: var(--success);
    box-shadow: 0 0 8px var(--success);
    animation: breathe 2s infinite ease-in-out;
}
.status-dot.offline {
    background: var(--danger);
    box-shadow: 0 0 8px var(--danger);
}
@keyframes breathe {
    0% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); opacity: 0.8; }
}
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; }
.live-dot.active { background: var(--success); box-shadow: 0 0 5px var(--success); }

/* Controls */
.controls { display: flex; gap: 1rem; align-items: center; }

.btn {
    padding: 0.4rem 0.7rem;
    border-radius: 0.8rem;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.75rem;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}
.btn i { width: 0.9rem; height: 0.9rem; }
.btn-p { background: var(--primary); color: white; }
.btn-p:hover { background: #4f46e5; transform: translateY(-2px); box-shadow: 0 4px 12px var(--primary-glow); }
.btn-s { background: var(--glass); color: var(--text); border: 1px solid var(--glass-border); }
.btn-s:hover { background: rgba(255, 255, 255, 0.1); border-color: var(--text-dim); }
.btn-danger { background: var(--danger); color: white; }
.btn-danger:hover { filter: brightness(1.1); transform: scale(1.02); }

/* Actions Dropdown */
.dropdown { position: relative; display: inline-block; }
.dropdown-trigger:hover { color: var(--accent); }
.dropdown-content {
    display: none;
    position: absolute;
    right: 0;
    background-color: #1e293b;
    min-width: 130px;
    box-shadow: 0px 8px 32px rgba(0,0,0,0.5);
    z-index: 100;
    border-radius: 1rem;
    border: 1px solid var(--glass-border);
    padding: 0.5rem;
    animation: fadeIn 0.2s ease-out;
}
.dropdown-content.show { display: block; }
.dropdown-item {
    color: var(--text-dim);
    padding: 0.6rem 0.8rem;
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    cursor: pointer;
    border-radius: 0.7rem;
    font-size: 0.8rem;
}
.dropdown-item:hover { background: rgba(255,255,255,0.05); color: white; }
.dropdown-item i { width: 0.9rem; height: 0.9rem; opacity: 0.7; }
.dropdown-item:hover i { opacity: 1; color: var(--accent); }

.action-flex { display: flex; gap: 0.4rem; align-items: center; flex-wrap: nowrap; }

/* Logs Terminal */
.log-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}
.terminal-container {
    background: #000;
    color: #0f0;
    font-family: 'Courier New', Courier, monospace;
    padding: 1.5rem;
    border-radius: 1rem;
    min-height: 400px;
    overflow-y: auto;
    white-space: pre-wrap;
    box-shadow: inset 0 0 20px rgba(0,255,0,0.05);
}
.log-date-header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin: 1.5rem 0;
    color: var(--accent);
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
}
.log-date-header::before, .log-date-header::after {
    content: "";
    flex: 1;
    height: 1px;
    background: linear-gradient(to right, transparent, var(--glass-border), transparent);
}

.dropdown-divider { height: 1px; background: var(--glass-border); margin: 0.4rem 0; }

select {
    background: #0f172a; color: #818cf8; border: 1px solid var(--glass-border);
    border-radius: 0.8rem; padding: 0.4rem 0.8rem; font-size: 0.8rem; outline: none; cursor: pointer;
}

#editor-container textarea {
    width: 100%; height: 500px; background: #0f172a; color: #f8fafc; border: 1px solid var(--glass-border);
    border-radius: 1rem; padding: 1.5rem; font-family: 'Fira Code', monospace; font-size: 0.9rem;
    margin: 1.5rem 0; resize: none; outline: none;
    scrollbar-width: none; -ms-overflow-style: none;
}
#editor-container textarea::-webkit-scrollbar { display: none; }
#info-container pre {
    background: #0f172a; color: #10b981; padding: 1.5rem; border-radius: 1rem;
    overflow-x: auto; font-family: 'Fira Code', monospace; font-size: 0.9rem;
}

.modal {
    position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
    display: none; align-items: center; justify-content: center; z-index: 50000;
    padding: 2rem;
}
.modal-content {
    background: #1e293b; border: 1px solid var(--glass-border); border-radius: 1.5rem;
    width: 100%; max-width: 800px; padding: 2rem; box-shadow: 0 25px 50px rgba(0,0,0,0.5);
    animation: fadeIn 0.3s ease-out;
}

.loader {
    position: fixed; top: 0; left: 0; right: 0; height: 3px; background: var(--primary);
    box-shadow: 0 0 10px var(--primary); z-index: 40000; display: none;
    animation: pulse 2s infinite;
}
@keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }

#toast {
    position: fixed; bottom: 2rem; right: 2rem; background: var(--primary); color: white;
    padding: 0.8rem 1.5rem; border-radius: 1rem; font-weight: 600;
    box-shadow: 0 10px 25px var(--primary-glow); display: none; z-index: 60000;
    animation: slideUp 0.3s ease-out;
}
@keyframes slideUp { from { transform: translateY(1rem); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

.auth-error {
    background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger); color: #f87171;
    padding: 1rem; border-radius: 1rem; margin-bottom: 2rem; display: none;
}

@media (max-width: 1024px) {
    aside { transform: translateX(-100%); width: 250px; }
    aside.open { transform: translateX(0); }
    main { margin-left: 0; padding: 2rem 1rem; }
    .mobile-toggle { display: block; }
    .header { margin-top: 3rem; }
    .dashboard-grid { grid-template-columns: 1fr; }
    .controls { flex-direction: column; align-items: stretch; }
    .btn { min-width: 60px; padding: 0.4rem 0.6rem; }
}

.overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999;
    display: none; backdrop-filter: blur(2px);
}

/* Terminal Section */
#section-terminal { 
    height: calc(100vh - 200px); display: none; flex-direction: column; 
    margin-bottom: 0; position: relative; overflow: visible;
}
#section-terminal.active { display: flex; animation: slideUp-terminal 0.6s cubic-bezier(0.2, 0.8, 0.2, 1); }

/* Background Glow behind terminal */
#section-terminal::before {
    content: ''; position: absolute; width: 600px; height: 400px;
    background: radial-gradient(circle, rgba(88, 166, 255, 0.12) 0%, transparent 70%);
    top: 20%; left: 50%; transform: translateX(-50%); z-index: 0; filter: blur(60px);
    pointer-events: none;
}

.terminal-outer-wrapper {
    position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column;
    background: var(--glass-bg); backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border: 1px solid var(--glass-border); border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
    overflow: hidden;
}

.terminal-header-bar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.8rem 1.5rem; background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid var(--glass-border);
}

.terminal-body-container {
    flex: 1; background: transparent; padding: 20px; overflow: hidden;
}

.terminal-title-box {
    display: flex; align-items: center; gap: 10px; font-size: 0.85rem;
    font-weight: 500; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em;
}

#xterm-container { width: 100%; height: 100%; }

.xterm, .xterm-screen, .xterm-viewport, .xterm-rows { background-color: transparent !important; }
.xterm-viewport { scrollbar-width: none !important; -ms-overflow-style: none !important; }
.xterm-viewport::-webkit-scrollbar { display: none !important; }

@keyframes slideUp-terminal {
    from { opacity: 0; transform: translateY(30px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

/* VNX Status Badge */
.status-badge {
    display: flex; align-items: center; gap: 8px;
    font-size: 0.75rem; font-weight: 600;
    padding: 4px 12px; background: rgba(0, 0, 0, 0.3);
    border-radius: 20px; border: 1px solid var(--glass-border);
    transition: all 0.3s ease;
}
.status-badge .dot { width: 6px; height: 6px; border-radius: 50%; }
.status-badge.online { color: #aff5b4; border-color: rgba(63, 185, 80, 0.3); }
.status-badge.online .dot { background: var(--status-online); box-shadow: 0 0 10px var(--status-online); }

.status-badge.connecting .dot { 
    background: var(--accent-blue); box-shadow: 0 0 10px var(--accent-blue);
    animation: pulse-terminal 1.5s infinite;
}

/* Status modifiers for the outer box (like in user project) */
.terminal-outer-wrapper.online { border-color: rgba(63, 185, 80, 0.2); }
.terminal-outer-wrapper.error { border-color: rgba(218, 54, 51, 0.3); }

.status-badge.offline .dot { background: #484f58; }
.status-badge.error .dot { background: var(--status-error); box-shadow: 0 0 10px var(--status-error); }

.badge {
    padding: 0.25rem 0.5rem; border-radius: 0.5rem; font-size: 0.7rem; font-weight: 600;
}
.badge-accent { background: rgba(192, 132, 252, 0.1); color: var(--accent); border: 1px solid rgba(192, 132, 252, 0.2); }
`;

export const BODY_CONTENT = `<div class="loader" id="loader"></div>
<div id="toast">Copied!</div>
<div class="overlay" id="overlay" onclick="toggleSidebar()"></div>

<div class="mobile-toggle" onclick="toggleSidebar()">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
</div>

<aside id="sidebar">
    <div class="logo">META VPS Center</div>
    <nav>
        <div id="nav-nodes" class="nav-item active" onclick="showSection('nodes')"><i data-lucide="server"></i>Inventory & Registry</div>
        <div id="nav-groups" class="nav-item" onclick="showSection('groups')"><i data-lucide="layers"></i>Group Mappings</div>
        <div id="nav-templates" class="nav-item" onclick="showSection('templates')"><i data-lucide="code"></i>Shell Templates</div>
        <div id="nav-configs" class="nav-item" onclick="showSection('configs')"><i data-lucide="database"></i>KV Configs (.JSON)</div>
        <div id="nav-ips" class="nav-item" onclick="showSection('ips')"><i data-lucide="globe"></i>IP Management</div>
        <div id="nav-cloud" class="nav-item" onclick="showSection('cloud')"><i data-lucide="cpu"></i>Cloud-init Meta</div>
        <div id="nav-logs" class="nav-item" onclick="showSection('logs')"><i data-lucide="scroll"></i>Logs & Activity</div>
        <div id="nav-global" class="nav-item" onclick="showSection('global')"><i data-lucide="shield"></i>Global & Security</div>
    </nav>
    <div style="margin-top: auto; padding: 1rem; border-top: 1px solid var(--glass-border); font-size: 0.75rem; color: var(--text-dim);">
        v2.6.0-stable | VNX PRO
    </div>
</aside>

<main>
    <div class="header">
        <h1 id="page-title">Inventory & Registry</h1>
        <div class="controls">
            <div class="search-container" id="nodes-search-box">
                <i data-lucide="search"></i>
                <input type="text" placeholder="Search by hostname or host..." oninput="handleSearch(event)">
            </div>
            <div id="live-indicator" style="display: flex; align-items: center; gap: 0.8rem; background: var(--glass); padding: 0.4rem 0.8rem; border-radius: 1rem; border: 1px solid var(--glass-border);">
                <div class="live-dot" id="live-dot"></div>
                <span id="live-text" style="font-size: 0.75rem; font-weight: 600; color: #94a3b8;">Live: Off</span>
            </div>
            <button class="btn btn-s" id="btn-live" onclick="toggleAutoRefresh()">Enable Auto-Live</button>
            <button class="btn btn-p" onclick="refreshStatusDots()"><i data-lucide="refresh-cw"></i>Sync Data</button>
        </div>
    </div>

    <div id="section-nodes" class="section active">
        <div class="dashboard-grid">
            <div class="card">
                <div class="card-title">Total Nodes</div>
                <div class="card-value" id="stat-total-nodes">0</div>
            </div>
            <div class="card">
                <div class="card-title">Active Groups</div>
                <div class="card-value" id="stat-active-groups">0</div>
            </div>
            <div class="card">
                <div class="card-title">KV Entries</div>
                <div class="card-value" id="stat-total-kv">0</div>
            </div>
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Hostname</th>
                        <th>Cloud Host</th>
                        <th>Group</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="nodes-table-body">
                    <tr><td colspan="4" style="text-align:center; padding: 3rem; color: var(--text-dim);">Loading inventory data...</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <div id="section-groups" class="section">
        <div class="auth-error" id="auth-warning">Invalid or missing token. Action unauthorized.</div>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Group Name</th>
                        <th>Node Count</th>
                        <th>Sync Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="groups-table-body"></tbody>
            </table>
        </div>
    </div>

    <div id="section-templates" class="section">
        <div style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
            <p style="color: var(--text-dim);">Custom shell scripts used during cloud-init or node management.</p>
            <button class="btn btn-p" onclick="openNewTemplate()"><i data-lucide="plus"></i>New Template</button>
        </div>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Template ID</th>
                        <th>Type</th>
                        <th>Last Modified</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="templates-table-body"></tbody>
            </table>
        </div>
    </div>

    <div id="section-configs" class="section">
        <p style="color: var(--text-dim); margin-bottom: 2rem;">Manage configuration sets for nodes and groups.</p>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Config Key</th>
                        <th>Scope</th>
                        <th>Type</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="configs-table-body"></tbody>
            </table>
        </div>
    </div>

    <div id="section-ips" class="section">
        <p style="color: var(--text-dim); margin-bottom: 2rem;">IP address pool and subnet allocation matrix.</p>
        <div class="table-container">
            <div style="padding: 4rem; text-align: center; color: var(--text-dim);">
                <i data-lucide="globe" style="width: 3rem; height: 3rem; margin-bottom: 1rem; opacity: 0.2;"></i>
                <p>IP Management module is being synchronized with global registry.</p>
            </div>
        </div>
    </div>

    <div id="section-cloud" class="section">
        <p style="color: var(--text-dim); margin-bottom: 2rem;">Cloud-init metadata and user-data orchestration.</p>
        <div class="table-container">
            <div style="padding: 4rem; text-align: center; color: var(--text-dim);">
                <i data-lucide="cpu" style="width: 3rem; height: 3rem; margin-bottom: 1rem; opacity: 0.2;"></i>
                <p>Fetching cloud-init metadata for regional clusters...</p>
            </div>
        </div>
    </div>

    <div id="section-logs" class="section">
        <div style="margin-bottom: 2rem; display: flex; gap: 1rem; align-items: center;">
            <select id="log-type-select" onchange="toggleLogView()">
                <option value="system">System Logs</option>
                <option value="live">Live Execution Logs</option>
            </select>
            <input type="text" id="log-host-filter" placeholder="Node Hostname (optional)..." style="background: var(--glass); color: white; border: 1px solid var(--glass-border); border-radius: 0.8rem; padding: 0.4rem 0.8rem; font-size: 0.8rem; outline: none;">
            <button class="btn btn-p" onclick="refreshLogs()">Sync Logs</button>
        </div>
        <div class="log-container" id="log-content-area">
            <div id="logs-list-system"></div>
            <div id="logs-list-live" style="display: none;"></div>
        </div>
        <div style="margin-top: 2rem; text-align: center;">
            <button class="btn btn-s" id="btn-load-more-logs" onclick="loadMoreLogs()">Load More Historical Logs</button>
        </div>
    </div>

    <div id="section-terminal" class="section">
        <div class="terminal-outer-wrapper" id="terminal-wrapper">
            <div class="terminal-header-bar">
                <div style="display: flex; align-items: center; gap: 1.2rem;">
                    <button class="btn btn-s" onclick="showSection('nodes')">
                        <i data-lucide="arrow-left"></i>Back to Nodes
                    </button>
                    <div class="terminal-title-box">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="4 17 10 11 4 5"></polyline>
                            <line x1="12" y1="19" x2="20" y2="19"></line>
                        </svg>
                        <span id="terminal-section-title">Terminal: None</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 1.5rem;">
                    <div id="status-badge" class="status-badge connecting">
                        <span class="dot"></span>
                        <span id="status-text">Đang kết nối...</span>
                    </div>
                    <div style="display: flex; gap: 0.8rem;">
                        <button class="btn btn-s" onclick="resetTerminal()">
                            <i data-lucide="refresh-cw"></i>Reconnect
                        </button>
                        <button class="btn btn-p" id="terminal-new-tab-btn" onclick="window.open(this.dataset.url, '_blank')">
                            <i data-lucide="external-link"></i>Open in New Tab
                        </button>
                    </div>
                </div>
            </div>
            <div class="terminal-body-container">
                <div id="xterm-container"></div>
            </div>
        </div>
    </div>

    <div id="section-global" class="section">
        <p style="color: var(--text-dim); margin-bottom: 2rem;">Global security policies and platform-wide configurations.</p>
        <div class="table-container">
            <div style="padding: 4rem; text-align: center; color: var(--text-dim);">
                <i data-lucide="shield" style="width: 3rem; height: 3rem; margin-bottom: 1rem; opacity: 0.2;"></i>
                <p>Global Security Matrix is active and monitoring platform integrity.</p>
            </div>
        </div>
    </div>
</main>

<div class="modal" id="modal" onclick="if(event.target === this) closeModal()">
    <div class="modal-content">
        <h2 id="modal-title" style="margin-bottom: 2rem;">Edit Content</h2>
        <div id="modal-message" style="margin-bottom: 1.5rem; color: var(--text-dim);"></div>
        <div id="editor-container">
            <textarea id="modal-textarea" spellcheck="false"></textarea>
        </div>
        <input type="text" id="modal-key-input" style="width: 100%; margin-bottom: 1rem; background: #0f172a; border: 1px solid var(--glass-border); border-radius: 1rem; padding: 0.8rem 1.5rem; color: white;">
        <div id="info-container" style="display: none;">
            <pre id="info-content"></pre>
        </div>
        <div id="modal-default-btns" style="display: flex; justify-content: flex-end; gap: 1rem;">
            <button class="btn btn-s" onclick="closeModal()">Cancel</button>
            <button class="btn btn-p" id="modal-save-btn" onclick="saveContent()">Save Changes</button>
        </div>
        <div id="modal-confirm-btns" style="display: none; justify-content: flex-end; gap: 1rem;">
            <button class="btn btn-s" onclick="closeModal()">Cancel</button>
            <button class="btn btn-p" id="modal-confirm-action-btn">Confirm</button>
        </div>
    </div>
</div>
<div id="font-force" style="font-family: 'Ubuntu Mono', monospace; position: absolute; opacity: 0; pointer-events: none;">font-loading-test</div>
`;
