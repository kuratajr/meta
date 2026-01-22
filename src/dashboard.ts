export const DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VPS Cloud Control Center</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&family=Ubuntu+Mono&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
    <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Ubuntu+Mono&display=swap');
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
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }

        .card {
            background: var(--glass);
            backdrop-filter: blur(10px);
            border: 1px solid var(--glass-border);
            border-radius: 1.5rem;
            padding: 1.5rem;
        }

        .stat-val { font-size: 2rem; font-weight: 600; margin-top: 0.5rem; color: var(--accent); }

        .section { display: none; animation: fadeIn 0.4s easeOut; }
        .section.active { display: block; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* Tables & Scrolling */
        .table-container { 
            background: var(--glass); 
            border: 1px solid var(--glass-border); 
            border-radius: 1.5rem;
            max-height: calc(100vh - 400px);
            min-height: 450px; /* Ensure space for dropdowns even with 1 row */
            overflow-y: auto;
            overflow-x: hidden;
            position: relative;
            scrollbar-width: none;
            -ms-overflow-style: none;
            padding-bottom: 2rem;
        }
        .table-container::-webkit-scrollbar { display: none; }

        table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
        thead { position: sticky; top: 0; z-index: 10; background: #111827; }
        th { text-align: center; padding: 1rem 0.5rem; border-bottom: 2px solid var(--glass-border); color: var(--text-dim); font-weight: 400; font-size: 0.85rem; }
        td { padding: 1rem 0.5rem; border-bottom: 1px solid var(--glass-border); vertical-align: middle; }

        .copyable { cursor: pointer; transition: color 0.2s; }
        .copyable:hover { color: var(--accent); text-decoration: underline; }

        /* Search Filter */
        .search-container {
            position: relative;
            display: none; /* Hidden by default */
            width: 280px;
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
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .search-container input:focus {
            border-color: var(--accent);
            background: rgba(0, 0, 0, 0.3);
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
        }
        .search-container i, .search-container svg {
            position: absolute;
            left: 1rem;
            top: 50% !important;
            transform: translateY(-50%) !important;
            width: 1rem;
            height: 1rem;
            opacity: 0.6;
            pointer-events: none;
            color: var(--accent);
            margin: 0 !important;
        }

        /* Status Dot */
        .status-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #475569; /* grey */
            margin-right: 8px;
            box-shadow: 0 0 5px rgba(0,0,0,0.5);
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

        /* Status Filter Logic */
        #table-nodes.filter-online tr[data-status="offline"] { display: none; }
        #table-nodes.filter-offline tr[data-status="online"] { display: none; }
        #table-nodes.filter-online thead tr, #table-nodes.filter-offline thead tr { display: table-row !important; }

        .live-indicator {
            display: flex; align-items: center; gap: 0.5rem;
            background: rgba(255, 255, 255, 0.05); padding: 0.4rem 0.8rem;
            border-radius: 2rem; font-size: 0.75rem; border: 1px solid var(--glass-border);
        }
        .live-dot { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; }
        .live-dot.active { background: var(--success); box-shadow: 0 0 5px var(--success); }

        /* Controls */
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
            justify-content: center;
            gap: 0.4rem;
            min-width: 65px;
            white-space: nowrap;
        }
        .btn i { width: 0.85rem; height: 0.85rem; }

        .btn-p { background: var(--primary); color: white; }
        .btn-p:hover { filter: brightness(1.1); transform: scale(1.02); }
        .btn-s { background: rgba(255,255,255,0.1); color: white; }
        .btn-s:hover { background: rgba(255,255,255,0.2); }
        .btn-start { background: var(--success); color: white; }
        .btn-destroy { background: var(--danger); color: white; }
        .btn-danger { background: var(--danger); color: white; }
        .btn-danger:hover { filter: brightness(1.1); transform: scale(1.02); }

        /* Actions Dropdown */
        .dropdown { position: relative; display: inline-block; }
        .dropdown-content {
            display: none;
            position: absolute;
            right: 0;
            background-color: #1e293b;
            min-width: 130px;
            box-shadow: 0px 8px 32px rgba(0,0,0,0.5);
            z-index: 1000;
            border-radius: 1rem;
            border: 1px solid var(--glass-border);
            margin-top: 5px;
            overflow: hidden;
        }
        .dropdown-content.show { display: block; }
        .dropdown-scroll-area {
            max-height: 126px; /* Approx 3 items */
            overflow-y: auto;
            scrollbar-width: none;
            -ms-overflow-style: none;
        }
        .dropdown-scroll-area::-webkit-scrollbar { display: none; }

        .dropdown-item {
            color: var(--text); padding: 0.6rem 1rem; text-decoration: none;
            display: flex; align-items: center; justify-content: flex-start; gap: 0.6rem;
            font-size: 0.75rem; font-weight: 500; transition: background 0.2s;
            cursor: pointer;
        }
        .dropdown-item i { width: 0.75rem; height: 0.75rem; opacity: 0.7; }
        .dropdown-item:hover { background: rgba(255, 255, 255, 0.1); color: var(--accent); }
        .dropdown-item:hover i { opacity: 1; color: var(--accent); }

        .action-flex { display: flex; gap: 0.4rem; align-items: center; flex-wrap: nowrap; }

        /* Logs Terminal */
        .terminal-container {
            background: #000;
            color: #0f0;
            font-family: 'Courier New', Courier, monospace;
            padding: 1.5rem;
            border-radius: 1rem;
            min-height: 400px;
            max-height: 600px;
            overflow-y: auto;
            border: 1px solid var(--glass-border);
            line-height: 1.5;
            font-size: 0.85rem;
            scrollbar-width: none;
            -ms-overflow-style: none;
        }
        .terminal-container::-webkit-scrollbar { display: none; }
        .log-entry { margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.3rem; font-family: inherit; }
        .log-time { color: var(--accent); font-size: 0.75rem; margin-right: 0.8rem; font-family: inherit; }

        .log-date-header {
            display: flex;
            align-items: center;
            gap: 1rem;
            color: var(--text-dim);
            font-size: 0.75rem;
            margin: 1.5rem 0 0.8rem;
            opacity: 0.5;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
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
            padding: 0.5rem; border-radius: 0.5rem; font-size: 0.85rem; outline: none;
            cursor: pointer; width: 100%;
        }

        /* Modal */
        .modal {
            position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
            display: none; align-items: center; justify-content: center; z-index: 20000;
        }
        .modal-content {
            background: #1e293b; width: 95%; max-width: 650px; padding: 2.5rem; border-radius: 2rem;
            border: 1px solid var(--glass-border); max-height: 90vh; overflow-y: auto;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .modal-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.8rem; }
        #modal-message { font-size: 1.1rem; line-height: 1.6; opacity: 0.9; margin-bottom: 2rem; }
        
        #editor-container textarea {
            width: 100%; height: 400px; background: #0f172a; color: #10b981; border: 1px solid var(--glass-border);
            border-radius: 1rem; padding: 1.5rem; font-family: 'Fira Code', monospace; font-size: 0.9rem;
            margin: 1.5rem 0; resize: none; outline: none;
            scrollbar-width: none; -ms-overflow-style: none;
        }
        #editor-container textarea::-webkit-scrollbar { display: none; }
        #info-container pre {
            background: #0f172a; color: #10b981; padding: 1.5rem; border-radius: 1rem;
            font-family: 'Fira Code', monospace; font-size: 0.95rem; line-height: 1.6;
            white-space: pre-wrap; word-break: break-all; overflow-y: auto;
            scrollbar-width: none; -ms-overflow-style: none;
        }
        #info-container pre::-webkit-scrollbar { display: none; }
        
        #modal-key-input input {
            width: 100%; background: #0f172a; border: 1px solid var(--glass-border); color: white;
            padding: 1rem; border-radius: 0.8rem; margin-top: 0.5rem; outline: none;
        }

        /* Toast */
        #toast {
            position: fixed; bottom: 2rem; right: 2rem; background: var(--primary); color: white;
            padding: 1rem 2rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            display: none; z-index: 30000; font-weight: 600; animation: slideIn 0.3s ease-out;
        }

        .loader {
            position: fixed; top: 0; left: 0; right: 0; height: 3px; background: var(--primary);
            box-shadow: 0 0 10px var(--primary); z-index: 40000; display: none;
            animation: pulse 2s infinite;
        }

        pre {
            background: #0f172a; color: #10b981; padding: 1.5rem; border-radius: 1rem;
            overflow-x: auto; font-family: 'Fira Code', monospace; font-size: 0.85rem;
            border: 1px solid var(--glass-border);
        }

        .auth-error {
            background: rgba(239, 68, 68, 0.1); color: var(--danger); padding: 1rem;
            border-radius: 1rem; border: 1px solid rgba(239, 68, 68, 0.2); margin-bottom: 2rem; display: none;
        }

        /* RESPONSIVE QUERIES */
        @media (max-width: 1024px) {
            aside { width: 240px; padding: 1.5rem; }
            main { margin-left: 240px; padding: 2rem; }
        }

        @media (max-width: 768px) {
            aside { transform: translateX(-100%); width: 280px; }
            aside.open { transform: translateX(0); }
            .mobile-toggle { display: block; }
            main { margin-left: 0; padding: 4.5rem 1rem 2rem 1rem; }
            .header { margin-bottom: 1.5rem; gap: 0.5rem; }
            .header h1 { font-size: 1.25rem; }
            .stats-grid { grid-template-columns: 1fr; gap: 1rem; margin-bottom: 2rem; }
            .card { padding: 1rem; border-radius: 1rem; }
            .stat-val { font-size: 1.6rem; margin-top: 0.2rem; }
            
            .table-container { max-height: calc(100vh - 450px); padding-bottom: 150px; }
            th, td { padding: 1rem 0.8rem; font-size: 0.85rem; }
            
            .modal-content { padding: 1.5rem; border-radius: 1.5rem; }
            textarea { height: 300px; padding: 1rem; font-size: 0.8rem; }
            .btn { min-width: 60px; padding: 0.4rem 0.6rem; }
        }

        .overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999;
            display: none; backdrop-filter: blur(2px);
        }

        /* Terminal Section */
        #section-terminal { height: calc(100vh - 200px); display: none; flex-direction: column; margin-bottom: 0; }
        #section-terminal.active { display: flex; }
        .terminal-header-bar {
            display: flex; justify-content: space-between; align-items: center;
            padding: 1rem 1.5rem; background: rgba(17, 24, 39, 0.95); border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 1rem 1rem 0 0; color: #94a3b8; font-family: "Outfit", sans-serif;
        }
        .terminal-body-container {
            flex: 1; background: rgba(17, 24, 39, 0.85); backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-top: none; border-radius: 0 0 1rem 1rem; overflow: hidden;
            padding: 1.5rem; position: relative;
        }
        .terminal-footer {
            padding: 0.5rem 1.5rem; font-size: 0.75rem; color: #4b5563; text-align: center;
            font-family: "Outfit", sans-serif; opacity: 0.8;
        }
        .badge-terminal-online {
            display: flex; align-items: center; gap: 0.5rem;
            background: rgba(16, 185, 129, 0.1); color: #10b981;
            padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.75rem; 
            border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .dot-online {
            width: 6px; height: 6px; background: #10b981; border-radius: 50%;
            box-shadow: 0 0 8px #10b981;
        }
        #xterm-container { width: 100%; height: 100%; }
        #xterm-container .xterm-viewport::-webkit-scrollbar { display: none; }
        #xterm-container .xterm-viewport { scrollbar-width: none; }
        .overlay.show { display: block; }

        .badge {
            padding: 0.25rem 0.5rem; border-radius: 0.5rem; font-size: 0.7rem; font-weight: 600;
        }
        .badge-accent { background: rgba(192, 132, 252, 0.1); color: var(--accent); border: 1px solid rgba(192, 132, 252, 0.2); }
    </style>
</head>
<body>
    <div class="loader" id="loader"></div>
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
        <div class="logo">VPS METALink</div>
        <nav>
            <div class="nav-item active" onclick="showSection('nodes')"><i data-lucide="server"></i>Inventory & Registry</div>
            <div class="nav-item" onclick="showSection('groups')"><i data-lucide="layers"></i>Group Mappings</div>
            <div class="nav-item" onclick="showSection('templates')"><i data-lucide="file-code"></i>Shell Templates</div>
            <div class="nav-item" onclick="showSection('configs')"><i data-lucide="database"></i>KV Configs (JSON)</div>
            <div class="nav-item" onclick="showSection('ip')"><i data-lucide="globe"></i>IP Management</div>
            <div class="nav-item" onclick="showSection('cloud')"><i data-lucide="cloud"></i>Cloud-init Meta</div>
            <div class="nav-item" onclick="showSection('logs')"><i data-lucide="terminal"></i>Logs & Activity</div>
            <div class="nav-item" onclick="showSection('global')"><i data-lucide="shield"></i>Global & Security</div>
        </nav>
        <div style="margin-top: auto; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 1rem;">
            <div style="font-size: 0.8rem; opacity: 0.6;">System Status</div>
            <div id="connection-status" style="color: var(--success); font-weight: 600;">● Online</div>
        </div>
    </aside>

    <main>
        <div class="auth-error" id="auth-warning">
            <strong>Authentication Error:</strong> Invalid or missing token.
        </div>

        <div class="header" style="align-items: center;">
            <h1 id="section-title" style="margin-bottom: 0;">Inventory & Registry</h1>

            <div style="display: flex; gap: 0.8rem; flex-wrap: wrap; align-items: center; margin-left: auto;">
                <div class="dropdown" id="status-filter-wrapper" style="display: none;">
                    <button class="btn btn-s dropdown-trigger" onclick="toggleDropdown(event)">
                        <i data-lucide="filter"></i>
                        <span id="filter-label">All</span>
                    </button>
                    <div class="dropdown-content">
                        <div class="dropdown-item" onclick="handleStatusFilter('all')">All Status</div>
                        <div class="dropdown-item" onclick="handleStatusFilter('online')">Online Only</div>
                        <div class="dropdown-item" onclick="handleStatusFilter('offline')">Offline Only</div>
                    </div>
                </div>
                <div class="search-container" id="search-wrapper">
                    <i data-lucide="search"></i>
                    <input type="text" id="table-search" placeholder="Search entries..." oninput="handleSearch(this.value)">
                </div>
                <div class="live-indicator" id="live-indicator">
                    <div class="live-dot" id="live-dot"></div>
                    <span id="live-text">Live: Off</span>
                </div>
                <button class="btn btn-s" onclick="toggleAutoRefresh()" id="btn-live">Enable Auto-Live</button>
                <button class="btn btn-s" onclick="refreshData()">Sync Data</button>
                <button class="btn btn-p" id="btn-create" style="display: none;" onclick="openCreateModal()">+ Create New</button>
            </div>
        </div>

        <div class="stats-grid">
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>Total Nodes</div>
                    <i data-lucide="cpu" style="color: var(--accent); opacity: 0.6;"></i>
                </div>
                <div class="stat-val" id="stat-nodes">0</div>
            </div>
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>Active Groups</div>
                    <i data-lucide="layers" style="color: var(--accent); opacity: 0.6;"></i>
                </div>
                <div class="stat-val" id="stat-groups">0</div>
            </div>
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>KV Entries</div>
                    <i data-lucide="database" style="color: var(--accent); opacity: 0.6;"></i>
                </div>
                <div class="stat-val" id="stat-kv">0</div>
            </div>
        </div>

        <div id="section-nodes" class="section active">
            <div class="table-container">
                <table id="table-nodes">
                    <thead><tr>
                        <th style="width: 15%;">Hostname</th>
                        <th style="width: 50%;">Cloud Host</th>
                        <th style="width: 10%;">Group</th>
                        <th style="width: 25%; text-align: center;">Actions</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>

        <div id="section-logs" class="section">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="opacity:0.7; margin:0;">System Activity</h3>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <input type="date" id="system-log-date" class="btn-s" style="background: var(--glass); border: 1px solid var(--glass-border); color: var(--text); padding: 0.3rem 0.5rem; border-radius: 0.5rem; font-size: 0.8rem;" onchange="handleSystemDateChange(this.value)">
                            <button class="btn btn-s" onclick="resetSystemLogs()" title="Reset Filter"><i data-lucide="rotate-ccw" style="width:1rem; height:1rem;"></i></button>
                        </div>
                    </div>
                    <div id="system-logs" class="terminal-container" style="height: 500px;" onscroll="handleLogScroll(event, 'system')">
                        <div style="opacity: 0.5;">Loading logs...</div>
                    </div>
                </div>
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="opacity:0.7; margin:0;">Live Node Logs: <span id="current-log-node" style="color:var(--accent)">None</span></h3>
                        <button class="btn btn-s" onclick="resetLiveLogs()" id="btn-reset-live" style="display:none;" title="Clear filter"><i data-lucide="x" style="width:1rem; height:1rem;"></i></button>
                    </div>
                    <div id="live-logs" class="terminal-container" style="height: 500px;" onscroll="handleLogScroll(event, 'live')">
                        <div style="opacity: 0.5;">Select a node to view live logs...</div>
                    </div>
                </div>
            </div>
        </div>

        <div id="section-groups" class="section">
             <div class="table-container">
                <table id="table-mapping">
                    <thead><tr>
                        <th style="width: 25%; text-align: left; padding-left: 1.5rem;">Group Name</th>
                        <th style="width: 55%; text-align: left;">Node List</th>
                        <th style="width: 20%; text-align: right; padding-right: 1.5rem;">Actions</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
            </div>
            <div style="margin-top: 2rem;">
                <button class="btn btn-p" onclick="editKV('groups')">Edit Central Mapping JSON</button>
            </div>
        </div>

        <div id="section-templates" class="section">
            <div class="stats-grid" id="grid-templates"></div>
        </div>

        <div id="section-ip" class="section">
            <div class="table-container">
                <table id="table-ips">
                    <thead><tr>
                        <th style="width: 35%; text-align: left; padding-left: 1.5rem;">Hostname</th>
                        <th style="width: 40%; text-align: left;">IP Address</th>
                        <th style="width: 25%; text-align: right; padding-right: 1.5rem;">Actions</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>

        <div id="section-cloud" class="section">
            <div class="table-container">
                <table id="table-cloud">
                    <thead><tr>
                        <th style="width: 40%; text-align: left; padding-left: 1.5rem;">Config Name</th>
                        <th style="width: 35%; text-align: left;">Type</th>
                        <th style="width: 25%; text-align: right; padding-right: 1.5rem;">Actions</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>

        <div id="section-configs" class="section">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
                <div>
                    <h3 style="margin-bottom:1rem; opacity:0.7;">Groups configs</h3>
                    <div id="list-group-configs" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
                </div>
                <div>
                     <h3 style="margin-bottom:1rem; opacity:0.7;">Node Overrides</h3>
                     <div id="list-node-configs" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
                </div>
            </div>
        </div>

        <div id="font-force" style="font-family: 'Ubuntu Mono', monospace; position: absolute; opacity: 0; pointer-events: none;">font-loading-test</div>
        <div id="section-terminal" class="section">
            <div class="terminal-header-bar">
                <div style="display: flex; align-items: center; gap: 0.8rem;">
                    <i data-lucide="terminal" style="width: 16px; height: 16px;"></i>
                    <span style="font-size: 0.85rem; font-weight: 500; letter-spacing: 0.05em;">VNX CLOUD TERMINAL</span>
                    <span style="opacity: 0.4; margin: 0 0.5rem;">|</span>
                    <span style="font-size: 0.8rem; opacity: 0.7;" id="terminal-section-title">thoainx01-17777777</span>
                    <button class="btn btn-s" style="margin-left: 1rem; opacity: 0.6;" onclick="showSection('nodes')"><i data-lucide="arrow-left"></i></button>
                </div>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div class="badge-terminal-online">
                        <div class="dot-online"></div>
                        Trực tuyến
                    </div>
                </div>
            </div>
            <div class="terminal-body-container">
                <div id="xterm-container"></div>
            </div>
            <div class="terminal-footer">
                @ 2026 VNX Cloud Platform. Nhấn Ctrl+L để xóa màn hình.
            </div>
        </div>

        <div id="section-global" class="section">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
                <div>
                    <h3 style="margin-bottom:1rem; opacity:0.7;">Global Configuration</h3>
                    <div id="global-config-area"></div>
                </div>
                <div>
                     <h3 style="margin-bottom:1rem; opacity:0.7;">Certificates & Keys</h3>
                     <div id="list-cert-configs" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
                </div>
            </div>

    </main>

    <div class="modal" id="modal">
        <div class="modal-content">
            <h2 id="modal-title" class="modal-title">Edit Configuration</h2>
            
            <div id="modal-key-input" style="display: none; margin-bottom: 1.5rem;">
                <label style="display: block; font-size: 0.8rem; opacity: 0.6; margin-bottom: 0.5rem;">Key Name</label>
                <input type="text" id="new-key-name" class="btn-s" style="width: 100%; background: var(--glass); border: 1px solid var(--glass-border); color: white; padding: 0.8rem 1rem; border-radius: 0.8rem; font-size: 1rem;">
            </div>

            <div id="modal-message" style="display: none;"></div>
            
            <div id="editor-container" style="display: none;"><textarea id="editor"></textarea></div>
            
            <div id="info-container" style="display: none;"><pre id="info-content"></pre></div>
            
            <div id="modal-default-btns" style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem;">
                <button class="btn btn-s" onclick="closeModal()">Close</button>
                <button class="btn btn-p" id="modal-save-btn" onclick="saveData()">Update</button>
            </div>

            <div id="modal-confirm-btns" style="display: none; justify-content: flex-end; gap: 1rem; margin-top: 1rem;">
                <button class="btn btn-s" onclick="closeModal()">Cancel</button>
                <button class="btn btn-p" id="modal-confirm-action-btn">Confirm</button>
            </div>
        </div>
    </div>

    <script>
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
                if (item.getAttribute('onclick').includes("'"+id+"'")) item.classList.add('active');
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
                const res = await fetch(\`/api/data?token=\${TOKEN}\`);
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
            
            document.getElementById('global-config-area').innerHTML = data.hasGlobal ? \`<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><span>global.json</span><div class="action-flex"><button class="btn btn-s" onclick="editKV('global')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('global')"><i data-lucide="trash"></i>Delete</button></div></div>\` : 'None.';
            if (window.lucide) lucide.createIcons();
        }

        const getGroupOf = (node) => {
            const g = groupsData.find(g => (g.listnode || "").split(',').map(s=>s.trim()).includes(node));
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
                groupsData.forEach(g => { groupOptions += \`<option value="\${g.config}" \${g.config === currentGroup ? 'selected' : ''}>\${g.config}</option>\`; });

                html += \`<tr data-status="\${previousStatuses[h] === true ? 'online' : (previousStatuses[h] === false ? 'offline' : '')}">
                    <td style="font-weight:600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                        <span class="status-dot" data-node="\${h}"></span>\${h}
                    </td>
                    <td class="copyable" onclick="copyToClipboard('\${regVal}')">
                        <div style="font-size: 0.75rem; opacity: 0.6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="\${regVal}">\${regVal}</div>
                    </td>
                    <td style="text-align: center;"><select onchange="updateNodeGroup('\${h}', this.value)" style="padding: 0.3rem; font-size: 0.75rem;">\${groupOptions}</select></td>
                    <td style="text-align: center;">
                        <div class="action-flex" style="justify-content: center;">
                            <button class="btn btn-s" onclick="editKV('node:\${h}')"><i data-lucide="settings"></i>Config</button>
                            <button class="btn btn-start" onclick="runNodeAction('\${h}', 'start')"><i data-lucide="play"></i>Start</button>
                            <button class="btn btn-destroy" onclick="runNodeAction('\${h}', 'destroy')"><i data-lucide="trash-2"></i>Destroy</button>
                            <div class="dropdown">
                                <button class="btn btn-s dropdown-trigger" onclick="toggleDropdown(event)">More</button>
                                <div class="dropdown-content">
                                    <div class="dropdown-scroll-area">
                                        <div class="dropdown-item" onclick="openTerminal('\${h}', '\${regVal}')"><i data-lucide="terminal"></i>Terminal</div>
                                        <div class="dropdown-item" onclick="fetchNodeInfo('\${h}')"><i data-lucide="info"></i>Info</div>
                                        <div class="dropdown-item" onclick="viewNodeLogs('\${h}')"><i data-lucide="align-left"></i>Logs</div>
                                        <div class="dropdown-item" onclick="runNodeAction('\${h}', 'stop')"><i data-lucide="square"></i>Stop</div>
                                        <div class="dropdown-item" onclick="runNodeAction('\${h}', 'reboot')"><i data-lucide="refresh-cw"></i>Reboot</div>
                                    </div>
                                    <div class="dropdown-divider"></div>
                                    <div class="dropdown-item" style="color:var(--danger);" onclick="deleteFromRegistry('\${h}')"><i data-lucide="trash-2"></i>Delete</div>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>\`;
            }
            nBody.innerHTML = html;
            refreshStatusDots();
            if (window.lucide) lucide.createIcons();
        }

        function renderGroups(data) {
            const mBody = document.querySelector('#table-mapping tbody');
            if (!mBody) return;
            mBody.innerHTML = (data.groups || []).filter(g => !currentSearch || g.config.toLowerCase().includes(currentSearch) || (g.listnode || '').toLowerCase().includes(currentSearch)).map(g => \`<tr>
                <td style="font-weight:600; padding-left: 1.5rem;">\${g.config}</td>
                <td style="opacity:0.8; font-size:0.85rem; line-height: 1.4; word-break: break-all; padding-right: 1rem;">\${(g.listnode || 'None').split(',').join(', ')}</td>
                <td style="text-align: right; padding-right: 1.5rem;"><div class="action-flex" style="justify-content: flex-end;"><button class="btn btn-s" onclick="editKV('group:\${g.config}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('group:\${g.config}')"><i data-lucide="trash"></i>Delete</button></div></td>
            </tr>\`).join('');
            if (window.lucide) lucide.createIcons();
        }

        function renderTemplates(data) {
            const tGrid = document.getElementById('grid-templates');
            if (!tGrid) return;
            tGrid.innerHTML = data.templates.filter(t => !currentSearch || t.toLowerCase().includes(currentSearch)).map(t => \`<div class="card">
                <div style="font-weight:600; margin-bottom:0.8rem; display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="file-text" style="color: var(--accent); width: 0.95rem; height: 0.95rem;"></i>\${t.replace('template:', '')}</div>
                <div class="action-flex"><button class="btn btn-s" onclick="editKV('\${t}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('\${t}')"><i data-lucide="trash"></i>Delete</button></div>
            </div>\`).join('');
            if (window.lucide) lucide.createIcons();
        }

        function renderConfigs(data) {
            const filter = (arr) => arr.filter(c => !currentSearch || c.toLowerCase().includes(currentSearch)).map(c => \`<div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:1rem; margin-bottom: 0.5rem;"><span>\${c}</span><div class="action-flex"><button class="btn btn-s" onclick="editKV('\${c}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('\${c}')"><i data-lucide="trash"></i>Delete</button></div></div>\`).join('');
            document.getElementById('list-group-configs').innerHTML = filter(data.groupConfigs);
            document.getElementById('list-node-configs').innerHTML = filter(data.nodeConfigs);
            document.getElementById('list-cert-configs').innerHTML = filter(data.certConfigs);
            if (window.lucide) lucide.createIcons();
        }

        function renderIPs(data) {
            const ipBody = document.querySelector('#table-ips tbody');
            if (!ipBody) return;
            ipBody.innerHTML = Object.keys(data.ips || {}).filter(node => !currentSearch || node.toLowerCase().includes(currentSearch) || (data.ips[node] || '').toLowerCase().includes(currentSearch)).map(node => \`<tr>
                <td style="font-weight:600; padding-left: 1.5rem;">ip:\${node}</td>
                <td class="copyable" onclick="copyToClipboard('\${data.ips[node]}')"><div style="opacity: 0.8; font-size: 0.85rem;">\${data.ips[node]}</div></td>
                <td style="text-align: right; padding-right: 1.5rem;"><div class="action-flex" style="justify-content: flex-end;"><button class="btn btn-s" onclick="editIP('\${node}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteIP('\${node}')"><i data-lucide="trash"></i>Delete</button></div></td>
            </tr>\`).join('');
            if (window.lucide) lucide.createIcons();
        }

        function renderCloudInit(data) {
            const cloudBody = document.querySelector('#table-cloud tbody');
            if (!cloudBody) return;
            cloudBody.innerHTML = (data.cloudConfigs || []).filter(c => !currentSearch || c.toLowerCase().includes(currentSearch)).map(c => \`<tr>
                <td style="font-weight:600; padding-left: 1.5rem;">\${c}</td>
                <td><span class="badge badge-accent">KV Storage</span></td>
                <td style="text-align: right; padding-right: 1.5rem;"><div class="action-flex" style="justify-content: flex-end;"><button class="btn btn-s" onclick="editKV('\${c}')"><i data-lucide="edit-3"></i>Edit</button><button class="btn btn-danger" onclick="deleteKV('\${c}')"><i data-lucide="trash"></i>Delete</button></div></td>
            </tr>\`).join('');
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
                    fetch(\`/api/batch-check-nodes?token=\${TOKEN}&offset=\${i}&limit=\${batchSize}&_=\${Date.now()}\`)
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
                        const msg = \`Node [\${node}] is now \${newStatus ? 'ONLINE' : 'OFFLINE'}\`;
                        fetch(\`/api/record-log?token=\${TOKEN}\`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ msg, node })
                        }).catch(() => {});
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
                let url = \`/api/logs?token=\${TOKEN}&offset=\${state.offset}&limit=100\`;
                if (state.date) url += \`&date=\${state.date}\`;
                
                const res = await fetch(\`\${url}&_=\${Date.now()}\`);
                const logs = await res.json();
                
                if (logs.length < 100) state.hasMore = false;
                
                let html = '';
                
                logs.forEach(l => {
                    const dateObj = new Date(l.time + " UTC");
                    const dateStr = dateObj.toLocaleDateString('en-GB');
                    
                    if (dateStr !== state.lastDateStr) {
                        html += \`<div class="log-date-header">\${dateStr}</div>\`;
                        state.lastDateStr = dateStr;
                    }
                    
                    html += \`<div class="log-entry"><span class="log-time">\${dateObj.toLocaleTimeString()}</span>\${l.msg}</div>\`;
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
            } catch(e) {
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
                const res = await fetch(\`/api/logs?token=\${TOKEN}&hostname=\${h}&offset=\${state.offset}&limit=100&_=\${Date.now()}\`);
                const logs = await res.json();
                
                if (logs.length < 100) state.hasMore = false;

                let html = '';
                if (!append) {
                    html += '<div style="background:#000; color:#0f0; padding:1.5rem; border-radius:1rem; border:1px solid var(--glass-border); line-height:1.5; font-size:0.85rem; font-family:\\'Courier New\\', Courier, monospace; min-height:400px;">';
                }
                
                logs.forEach(l => {
                    const dateObj = new Date(l.time + " UTC");
                    const dateStr = dateObj.toLocaleDateString('en-GB');
                    if (dateStr !== state.lastDateStr) {
                        html += \`<div class="log-date-header" style="margin-top:\${state.lastDateStr ? '1.5rem' : '0'}">\${dateStr}</div>\`;
                        state.lastDateStr = dateStr;
                    }
                    html += \`<div class="log-entry" style="margin-bottom:0.4rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.2rem;"><span class="log-time" style="color:var(--accent); font-size:0.75rem; margin-right:0.8rem;">\${dateObj.toLocaleTimeString()}</span>\${l.msg}</div>\`;
                });
                
                if (!append) {
                    html += (logs.length === 0 ? '<div style="opacity:0.5">No history found for this node.</div>' : '') + '</div>';
                    html += \`<div style="margin-top:1rem; text-align:right;"><button class="btn btn-s" onclick="fetchRawShellLogs('\${h}')"><i data-lucide="terminal"></i> View Raw Shell Logs</button></div>\`;
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
        const res = await fetch(\`/api/node-proxy?token=\${TOKEN}&hostname=\${h}&endpoint=logs\`);
        const data = await res.text();
        let html = \`<div style="margin-bottom:1rem;"><button class="btn btn-s" onclick="viewNodeLogs('\${h}')"><i data-lucide="arrow-left"></i> Back to History</button></div>\`;
        html += \`<div style="background:#000; color:#0f0; padding:1.5rem; border-radius:1rem; border:1px solid var(--glass-border); line-height:1.5; font-size:0.85rem; font-family:\\'Courier New\\', Courier, monospace; min-height:400px; max-height:600px; overflow-y:auto; white-space:pre-wrap;">\${data || 'No shell logs returned.'}</div>\`;
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
        const res = await fetch(\`/api/node-proxy?token=\${TOKEN}&hostname=\${h}&endpoint=nodeinfo\`);
        const raw = await res.text();
        let display = raw;
        try { display = JSON.stringify(JSON.parse(raw), null, 4); } catch (e) { }
        showModal({ title: \`Node Info: \${h}\`, content: display, mode: 'info' });
    } catch (e) { showModal({ title: 'Error', message: 'Failed to fetch node info.', mode: 'alert' }); }
    document.getElementById('loader').style.display = 'none';
}

async function runNodeAction(h, a) {
    const executeAction = async () => {
        document.getElementById('loader').style.display = 'block';
        try {
            await fetch(\`/api/node-proxy?token=\${TOKEN}&hostname=\${h}&endpoint=\${a}\`);
            const msg = \`Requested action: \${a.toUpperCase()}\`;
            fetch(\`/api/record-log?token=\${TOKEN}\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ msg, node: h })
            }).catch(() => { });
            showModal({ title: 'Action Sent', message: \`Action \${a} for node \${h} has been requested.\`, mode: 'alert' });
        } catch (e) {
            showModal({ title: 'Error', message: \`Failed to execute \${a}.\`, mode: 'alert' });
        }
        document.getElementById('loader').style.display = 'none';
    };

    if (['start', 'stop', 'reboot', 'destroy'].includes(a)) {
        showModal({
            title: \`Confirm \${a.toUpperCase()}\`,
            message: \`Are you sure you want to \${a} node \${h}?\`,
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
                await fetch(\`/api/save?token=\${TOKEN}\`, {
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
        message: \`Are you sure you want to delete \${h} from the registry?\`,
        mode: 'confirm',
        onConfirm: async () => {
            document.getElementById('loader').style.display = 'block';
            try {
                const res = await fetch(\`/api/data?token=\${TOKEN}\`);
                const data = await res.json();
                const registry = data.registry;
                delete registry[h];
                await fetch(\`/api/save?token=\${TOKEN}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'registry', value: JSON.stringify(registry, null, 4) })
                });
                const updatedGroups = (data.groups || []).map(item => {
                    let nodes = (item.listnode || "").split(',').map(s => s.trim()).filter(s => s && s !== h);
                    return { ...item, listnode: nodes.join(',') };
                });
                await fetch(\`/api/save?token=\${TOKEN}\`, {
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
        const res = await fetch(\`/api/get-kv?token=\${TOKEN}&key=\${k}\`);
        document.getElementById('editor').value = await res.text();
    } catch (e) { }
    document.getElementById('loader').style.display = 'none';
}

function openCreateModal() {
    isNew = true;
    const currentSection = document.querySelector('.section.active').id;
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
                const res = await fetch(\`/api/data?token=\${TOKEN}\`);
                const data = await res.json();
                document.getElementById('editor').value = data.ips[node] || "";
                document.getElementById('modal').style.display = 'flex';
            } catch (e) { }
            document.getElementById('loader').style.display = 'none';
        }

        async function saveData() {
            const currentSection = document.querySelector('.section.active').id;
            const key = isNew ? document.getElementById('new-key-name').value : currentKey;
            const val = document.getElementById('editor').value;
            if (!key) return showModal({ title: 'Input Required', message: 'Key name is required.', mode: 'alert' });
            document.getElementById('loader').style.display = 'block';
            try {
                if (currentSection === 'section-ip' || (key.startsWith('ip:') && !isNew)) {
                    const node = key.startsWith('ip:') ? key.replace('ip:', '') : key;
                    const res = await fetch(\`/api/data?token=\${TOKEN}\`);
                    const data = await res.json();
                    const ips = data.ips || {};
                    ips[node] = val;
                    await fetch(\`/api/save?token=\${TOKEN}\`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: 'ips', value: JSON.stringify(ips, null, 2) })
                    });
                } else {
                    await fetch(\`/api/save?token=\${TOKEN}\`, {
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
        message: \`Delete ip:\${node}?\`,
        mode: 'confirm',
        onConfirm: async () => {
            document.getElementById('loader').style.display = 'block';
            try {
                const res = await fetch(\`/api/data?token=\${TOKEN}\`);
                const data = await res.json();
                const ips = data.ips || {};
                delete ips[node];
                await fetch(\`/api/save?token=\${TOKEN}\`, {
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
        message: \`Delete key "\${key}"?\`,
        mode: 'confirm',
        onConfirm: async () => {
            document.getElementById('loader').style.display = 'block';
            try {
                const res = await fetch(\`/api/delete?token=\${TOKEN}\`, {
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

        function openTerminal(h, hostUrl) {
            currentTerminalNode = h;
            currentTerminalUrl = hostUrl;
            showSection('terminal');
            
            const terminalTitle = document.getElementById('terminal-section-title');
            terminalTitle.innerText = h;
            
            // @ts-ignore
            if (window.lucide) window.lucide.createIcons();
            
            initXterm(h);
        }

        function initXterm(h) {
            if (termWs) { try { termWs.close(); } catch(e){} }
            termWs = null;
            const container = document.getElementById('xterm-container');
            container.innerHTML = '';

            // @ts-ignore
            xterm = new Terminal({
                cursorBlink: true,
                fontSize: 14,
                fontFamily: '"Ubuntu Mono", monospace',
                theme: { 
                    background: 'transparent',
                    foreground: '#10b981', // Prompt green
                    cursor: '#ffffff',
                    black: '#1f2937',
                    red: '#ef4444',
                    green: '#10b981',
                    yellow: '#f59e0b',
                    blue: '#3b82f6',
                    magenta: '#8b5cf6',
                    cyan: '#06b6d4',
                    white: '#f3f4f6'
                },
                allowTransparency: true,
                cols: 100,
                rows: 30
            });

            // @ts-ignore
            xtermFit = new FitAddon.FitAddon();
            xterm.loadAddon(xtermFit);
            xterm.open(container);
            
            // Critical: Wait for font to settle and re-apply to force xterm to re-calculate character widths
            setTimeout(() => {
                xterm.options.fontFamily = '"Ubuntu Mono", monospace';
                try {
                    xtermFit.fit();
                    // Force a re-render of all characters
                    xterm.refresh(0, xterm.rows - 1);
                    if (xterm.cols < 10) xterm.resize(100, 30);
                } catch (e) {
                    xterm.resize(100, 30);
                }
                connectWs(h);
            }, 800);
        }

        function connectWs(h) {
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            // Path structure for our proxy: /terminal-proxy/[token]/[node]/ws
            const wsUrl = protocol + "//" + location.host + "/terminal-proxy/" + TOKEN + "/" + h + "/ws";
            
            // @ts-ignore
            termWs = new WebSocket(wsUrl, 'tty');
            termWs.binaryType = 'arraybuffer';
            
            const decoder = new TextDecoder();
            
            termWs.onopen = () => {
                // Show VNX System Message
                xterm.write('\\x1b[1;32m[Hệ thống] Kết nối thành công! Đang đồng bộ hóa...\\x1b[0m\\r\\n');
                
                // Small delay to ensure the server is ready to receive the init JSON
                setTimeout(() => {
                    const initMsg = JSON.stringify({
                        "AuthToken": "",
                        "columns": xterm.cols,
                        "rows": xterm.rows
                    });
                    termWs.send(initMsg);
                }, 200);
            };

            termWs.onmessage = (ev) => {
                let msg = "";
                if (ev.data instanceof ArrayBuffer) {
                    msg = decoder.decode(new Uint8Array(ev.data));
                } else {
                    msg = ev.data;
                }

                if (typeof msg === 'string') {
                    if (msg.startsWith('0')) {
                        xterm.write(msg.slice(1));
                    } else if (msg.startsWith('1') || msg.startsWith('2')) {
                        // Protocol messages, ignore for raw terminal output
                    } else {
                        xterm.write(msg);
                    }
                }
            };

            termWs.onclose = () => {
                xterm.write('\\r\\n\\x1b[31m[System] Connection closed.\\x1b[0m\\r\\n');
            };

            termWs.onerror = () => {
                xterm.write('\\r\\n\\x1b[31m[System] Connection error.\\x1b[0m\\r\\n');
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

        // Reset timer on manual sync
        const originalRefreshData = refreshData;
        refreshData = async () => {
            await originalRefreshData();
            if (isLive) countdown = 30;
        };

        if (TOKEN) {
            // Set initial date picker to today (local time)
            const today = new Date().toLocaleDateString('en-CA');
            const systemLogDateInput = document.getElementById('system-log-date');
            if (systemLogDateInput) systemLogDateInput.value = today;
            
            showSection('nodes');
            refreshData();
        }
        else document.getElementById('auth-warning').style.display = 'block';
    </script>
</body>
</html>
`;
