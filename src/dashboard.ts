export const DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VPS Cloud Control Center</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
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
            padding: 1rem;
            border-radius: 1rem;
            cursor: pointer;
            transition: all 0.2s;
            color: var(--text-dim);
            font-weight: 400;
        }

        .nav-item:hover { background: rgba(255, 255, 255, 0.05); color: var(--text); }
        .nav-item.active { background: var(--primary); color: white; box-shadow: 0 4px 15px var(--primary-glow); }

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
            overflow-y: auto;
            position: relative;
            scrollbar-width: none;
            -ms-overflow-style: none;
            padding-bottom: 120px;
        }
        .table-container::-webkit-scrollbar { display: none; }

        table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 800px; }
        thead { position: sticky; top: 0; z-index: 10; background: #111827; }
        th { text-align: center; padding: 1.2rem; border-bottom: 2px solid var(--glass-border); color: var(--text-dim); font-weight: 400; font-size: 0.9rem; }
        td { padding: 1.2rem; border-bottom: 1px solid var(--glass-border); }

        .copyable { cursor: pointer; transition: color 0.2s; }
        .copyable:hover { color: var(--accent); text-decoration: underline; }

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

        /* Controls */
        .btn {
            padding: 0.5rem 0.8rem;
            border-radius: 0.8rem;
            border: none;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.75rem;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 65px;
            white-space: nowrap;
        }

        .btn-p { background: var(--primary); color: white; }
        .btn-p:hover { filter: brightness(1.1); transform: scale(1.02); }
        .btn-s { background: rgba(255,255,255,0.1); color: white; }
        .btn-s:hover { background: rgba(255,255,255,0.2); }
        .btn-start { background: var(--success); color: white; }
        .btn-destroy { background: var(--danger); color: white; }

        /* Actions Dropdown */
        .dropdown { position: relative; display: inline-block; }
        .dropdown-content {
            display: none;
            position: absolute;
            right: 0;
            background-color: #1e293b;
            min-width: 140px;
            box-shadow: 0px 8px 16px 16px rgba(0,0,0,0.4);
            z-index: 1000;
            border-radius: 0.8rem;
            border: 1px solid var(--glass-border);
            overflow: hidden;
            margin-top: 5px;
        }
        .dropdown-content.show { display: block; }
        .dropdown-item {
            color: var(--text); padding: 0.8rem 1rem; text-decoration: none;
            display: block; font-size: 0.8rem; font-weight: 500; transition: background 0.2s;
            cursor: pointer; text-align: left;
        }
        .dropdown-item:hover { background: rgba(255, 255, 255, 0.1); color: var(--accent); }

        .action-flex { display: flex; gap: 0.4rem; align-items: center; flex-wrap: nowrap; }

        select {
            background: #0f172a; color: #818cf8; border: 1px solid var(--glass-border);
            padding: 0.5rem; border-radius: 0.5rem; font-size: 0.85rem; outline: none;
            cursor: pointer; width: 100%;
        }

        /* Modal */
        .modal {
            position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);
            display: none; align-items: center; justify-content: center; z-index: 20000;
        }
        .modal-content {
            background: #1e293b; width: 95%; max-width: 800px; padding: 2.5rem; border-radius: 2rem;
            border: 1px solid var(--glass-border); max-height: 90vh; overflow-y: auto;
        }
        textarea {
            width: 100%; height: 400px; background: #0f172a; color: #10b981; border: 1px solid var(--glass-border);
            border-radius: 1rem; padding: 1.5rem; font-family: 'Fira Code', monospace; font-size: 0.9rem;
            margin: 1.5rem 0; resize: none;
        }
        #info-content {
            background: #0f172a; color: #10b981; padding: 1.5rem; border-radius: 1rem;
            font-family: 'Fira Code', monospace; font-size: 0.95rem; line-height: 1.6;
            white-space: pre-wrap; word-break: break-all; overflow-y: auto;
            scrollbar-width: none; -ms-overflow-style: none;
        }
        #info-content::-webkit-scrollbar { display: none; }
        input {
            width: 100%; background: #0f172a; border: 1px solid var(--glass-border); color: white;
            padding: 1rem; border-radius: 0.8rem; margin-top: 0.5rem;
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
        .overlay.show { display: block; }
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
            <div class="nav-item active" onclick="showSection('nodes')">Inventory & Registry</div>
            <div class="nav-item" onclick="showSection('groups')">Group Mappings</div>
            <div class="nav-item" onclick="showSection('templates')">Shell Templates</div>
            <div class="nav-item" onclick="showSection('configs')">KV Configs (JSON)</div>
            <div class="nav-item" onclick="showSection('system')">Global & Security</div>
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

        <div class="header">
            <h1 id="section-title">Inventory & Registry</h1>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button class="btn btn-s" onclick="refreshData()">Sync Data</button>
                <button class="btn btn-p" id="btn-create" style="display: none;" onclick="openCreateModal()">+ Create New</button>
            </div>
        </div>

        <div class="stats-grid">
            <div class="card"><div>Total Nodes</div><div class="stat-val" id="stat-nodes">0</div></div>
            <div class="card"><div>Active Groups</div><div class="stat-val" id="stat-groups">0</div></div>
            <div class="card"><div>KV Entries</div><div class="stat-val" id="stat-kv">0</div></div>
        </div>

        <div id="section-nodes" class="section active">
            <div class="table-container">
                <table id="table-nodes">
                    <thead><tr>
                        <th style="width: 20%; min-width: 150px;">Hostname</th>
                        <th style="width: 40%; min-width: 200px;">Cloud Host</th>
                        <th style="width: 15%; min-width: 100px;">Group</th>
                        <th style="width: 25%; min-width: 220px; text-align: center;">Actions</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>

        <div id="section-groups" class="section">
             <div class="table-container">
                <table id="table-mapping">
                    <thead><tr><th>Config ID</th><th>Node List</th><th>Action</th></tr></thead>
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

        <div id="section-system" class="section">
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
        </div>
    </main>

    <div class="modal" id="modal">
        <div class="modal-content">
            <h2 id="modal-title">Edit Configuration</h2>
            <div id="modal-key-input" style="display: none;"><label>Key Name</label><input type="text" id="new-key-name"></div>
            <div id="editor-container"><textarea id="editor"></textarea></div>
            <div id="info-container" style="display: none;"><pre id="info-content" style="max-height: 60vh;"></pre></div>
            <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem;">
                <button class="btn btn-s" onclick="closeModal()">Close</button>
                <button class="btn btn-p" id="modal-save-btn" onclick="saveData()">Update</button>
            </div>
        </div>
    </div>

    <script>
        const TOKEN = new URLSearchParams(window.location.search).get('token');
        let currentKey = '';
        let isNew = false;
        let groupsData = []; 

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
            document.getElementById('section-title').innerText = id.charAt(0).toUpperCase() + id.slice(1);
            const btn = document.getElementById('btn-create');
            btn.style.display = (id === 'templates' || id === 'configs' || id === 'system') ? 'block' : 'none';
        }

        async function refreshData() {
            if (!TOKEN) { document.getElementById('auth-warning').style.display = 'block'; return; }
            document.getElementById('loader').style.display = 'block';
            document.getElementById('connection-status').innerText = '● Syncing...';
            document.getElementById('connection-status').style.color = 'var(--accent)';

            try {
                const res = await fetch(\`/api/data?token=\${TOKEN}\`);
                const data = await res.json();
                groupsData = data.groups || [];
                
                document.getElementById('stat-nodes').innerText = Object.keys(data.registry).length;
                document.getElementById('stat-groups').innerText = groupsData.length;
                document.getElementById('stat-kv').innerText = (data.templates.length + data.groupConfigs.length + data.nodeConfigs.length + data.certConfigs.length + (data.hasGlobal ? 1 : 0));

                const getGroupOf = (node) => {
                    const g = groupsData.find(g => (g.listnode || "").split(',').map(s=>s.trim()).includes(node));
                    return g ? g.config : "None";
                };

                const nBody = document.querySelector('#table-nodes tbody');
                nBody.innerHTML = '';
                for (const h in data.registry) {
                    const currentGroup = getGroupOf(h);
                    let groupOptions = '<option value="">None</option>';
                    groupsData.forEach(g => { groupOptions += \`<option value="\${g.config}" \${g.config === currentGroup ? 'selected' : ''}>\${g.config}</option>\`; });

                    nBody.innerHTML += \`<tr>
                        <td style="font-weight:600; min-width:150px;">
                            <span class="status-dot" data-node="\${h}"></span>\${h}
                        </td>
                        <td class="copyable" style="min-width:200px;" onclick="copyToClipboard('\${data.registry[h]}')">
                            <div style="font-size: 0.8rem; opacity: 0.6; max-width: 100%; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">\${data.registry[h]}</div>
                        </td>
                        <td style="text-align: center; min-width:100px;"><select onchange="updateNodeGroup('\${h}', this.value)">\${groupOptions}</select></td>
                        <td style="text-align: center; min-width:220px;">
                            <div class="action-flex" style="justify-content: center;">
                                <button class="btn btn-s" onclick="editKV('node:\${h}')">Config</button>
                                <button class="btn btn-start" onclick="runNodeAction('\${h}', 'start')">Start</button>
                                <button class="btn btn-destroy" onclick="runNodeAction('\${h}', 'destroy')">Destroy</button>
                                <div class="dropdown">
                                    <button class="btn btn-s dropdown-trigger" onclick="toggleDropdown(event)">More</button>
                                    <div class="dropdown-content">
                                        <div class="dropdown-item" onclick="fetchNodeInfo('\${h}')">Info</div>
                                        <div class="dropdown-item" onclick="runNodeAction('\${h}', 'stop')">Stop</div>
                                        <div class="dropdown-item" onclick="runNodeAction('\${h}', 'reboot')">Reboot</div>
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>\`;
                }

                // Render Other sections
                const mBody = document.querySelector('#table-mapping tbody');
                if (mBody) {
                    mBody.innerHTML = (data.groups || []).map(g => \`<tr>
                        <td style="font-weight:600;">\${g.config}</td>
                        <td style="opacity:0.8; font-size:0.85rem;">\${g.listnode || 'None'}</td>
                        <td><button class="btn btn-s" onclick="editKV('group:\${g.config}')">Edit Config</button></td>
                    </tr>\`).join('');
                }

                const tGrid = document.getElementById('grid-templates');
                if (tGrid) {
                    tGrid.innerHTML = data.templates.map(t => \`<div class="card">
                        <div style="font-weight:600; margin-bottom:0.5rem;">\${t.replace('template:', '')}</div>
                        <button class="btn btn-s" onclick="editKV('\${t}')">Edit Template</button>
                    </div>\`).join('');
                }

                refreshStatusDots();

                document.getElementById('list-group-configs').innerHTML = data.groupConfigs.map(c => \`<div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:1rem; margin-bottom: 0.5rem;"><span>\${c}</span><button class="btn btn-s" onclick="editKV('\${c}')">Edit</button></div>\`).join('');
                document.getElementById('list-node-configs').innerHTML = data.nodeConfigs.map(c => \`<div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:1rem; margin-bottom: 0.5rem;"><span>\${c}</span><button class="btn btn-s" onclick="editKV('\${c}')">Edit</button></div>\`).join('');
                document.getElementById('list-cert-configs').innerHTML = data.certConfigs.map(c => \`<div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:1rem; margin-bottom: 0.5rem;"><span>\${c}</span><button class="btn btn-s" onclick="editKV('\${c}')">Edit</button></div>\`).join('');
                document.getElementById('global-config-area').innerHTML = data.hasGlobal ? \`<div class="card" style="display:flex; justify-content:space-between; align-items:center;"><span>global.json</span><button class="btn btn-p" onclick="editKV('global')">Configure</button></div>\` : 'None.';

document.getElementById('connection-status').innerText = '● Online';
document.getElementById('connection-status').style.color = 'var(--success)';
            } catch (e) { document.getElementById('connection-status').innerText = '● Error'; }
document.getElementById('loader').style.display = 'none';
        }

async function refreshStatusDots() {
    try {
        const res = await fetch(\`/api/batch-check-nodes?token=\${TOKEN}\`);
                const statuses = await res.json();
                document.querySelectorAll('.status-dot').forEach(dot => {
                    const node = dot.getAttribute('data-node');
                    if (statuses[node] === true) { dot.className = 'status-dot online'; }
                    else if (statuses[node] === false) { dot.className = 'status-dot offline'; }
                });
            } catch (e) {}
        }

        function toggleDropdown(event) {
            event.stopPropagation();
            const content = event.currentTarget.nextElementSibling;
            const isShow = content.classList.contains('show');
            document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
            if (!isShow) content.classList.add('show');
        }

        window.onclick = function(event) {
            if (!event.target.matches('.dropdown-trigger')) document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
        }

        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('.table-container').forEach(c => c.addEventListener('scroll', () => {
                document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
            }));
        });

        async function copyToClipboard(text) { try { await navigator.clipboard.writeText(text); showToast("Copied!"); } catch (err) {} }
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
                try {
                    const parsed = JSON.parse(raw);
                    display = JSON.stringify(parsed, null, 4);
                } catch(e) {}
                
                document.getElementById('modal-title').innerText = \`Node Info: \${h}\`;
                document.getElementById('editor-container').style.display = 'none';
                document.getElementById('info-container').style.display = 'block';
                document.getElementById('modal-save-btn').style.display = 'none';
                document.getElementById('info-content').innerText = display;
                document.getElementById('modal').style.display = 'flex';
            } catch (e) {}
            document.getElementById('loader').style.display = 'none';
        }

        async function runNodeAction(h, a) {
            if (a === 'destroy' && !confirm(\`Destroy \${h}?\`)) return;
            document.getElementById('loader').style.display = 'block';
            try { await fetch(\`/api/node-proxy?token=\${TOKEN}&hostname=\${h}&endpoint=\${a}\`); alert('Requested.'); } catch (e) {}
            document.getElementById('loader').style.display = 'none';
        }

        async function updateNodeGroup(h, g) {
            document.getElementById('loader').style.display = 'block';
            const updated = groupsData.map(item => {
                let nodes = (item.listnode || "").split(',').map(s=>s.trim()).filter(s => s && s !== h);
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
            } catch (e) {}
        }

        async function editKV(k) {
            currentKey = k; isNew = false;
            document.getElementById('modal-title').innerText = 'Edit ' + k;
            document.getElementById('modal-key-input').style.display = 'none';
            document.getElementById('editor-container').style.display = 'block';
            document.getElementById('info-container').style.display = 'none';
            document.getElementById('modal-save-btn').style.display = 'block';
            document.getElementById('loader').style.display = 'block';
            try {
                const res = await fetch(\`/api/get-kv?token=\${TOKEN}&key=\${k}\`);
                document.getElementById('editor').value = await res.text();
                document.getElementById('modal').style.display = 'flex';
            } catch (e) {}
            document.getElementById('loader').style.display = 'none';
        }

        function openCreateModal() {
            isNew = true; document.getElementById('modal-title').innerText = 'New Config';
            document.getElementById('modal-key-input').style.display = 'block';
            document.getElementById('editor-container').style.display = 'block';
            document.getElementById('info-container').style.display = 'none';
            document.getElementById('modal-save-btn').style.display = 'block';
            document.getElementById('editor').value = '{}';
            document.getElementById('modal').style.display = 'flex';
        }

        async function saveData() {
            const key = isNew ? document.getElementById('new-key-name').value : currentKey;
            const val = document.getElementById('editor').value;
            if (!key) return alert('Key required.');
            document.getElementById('loader').style.display = 'block';
            try {
                await fetch(\`/api/save?token=\${TOKEN}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key, value: val })
                });
                closeModal(); refreshData();
            } catch (e) {}
            document.getElementById('loader').style.display = 'none';
        }

        function closeModal() { document.getElementById('modal').style.display = 'none'; }
        if (TOKEN) refreshData();
        else document.getElementById('auth-warning').style.display = 'block';
    </script>
</body>
</html>
`;
