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
        }

        /* Sidebar */
        aside {
            width: 280px;
            background: rgba(15, 23, 42, 0.8);
            border-right: 1px solid var(--glass-border);
            padding: 2rem;
            display: flex;
            flex-direction: column;
            gap: 2rem;
            position: fixed;
            height: 100vh;
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

        /* Main Content */
        main {
            margin-left: 280px;
            flex: 1;
            padding: 3rem;
            max-width: 1400px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 3rem;
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

        /* Tables */
        .table-container { 
            background: var(--glass); 
            border: 1px solid var(--glass-border); 
            border-radius: 1.5rem;
            overflow: hidden;
        }

        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 1.2rem; background: rgba(255,255,255,0.03); color: var(--text-dim); font-weight: 400; font-size: 0.9rem; }
        td { padding: 1.2rem; border-bottom: 1px solid var(--glass-border); }

        /* Controls */
        .btn {
            padding: 0.6rem 1.2rem;
            border-radius: 0.8rem;
            border: none;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.8rem;
            transition: all 0.2s;
        }

        .btn-p { background: var(--primary); color: white; }
        .btn-p:hover { filter: brightness(1.1); transform: scale(1.02); }
        .btn-s { background: rgba(255,255,255,0.1); color: white; }
        .btn-s:hover { background: rgba(255,255,255,0.2); }
        .btn-info { background: #3b82f6; color: white; }
        .btn-info:hover { filter: brightness(1.1); }

        .tag {
            background: rgba(99, 102, 241, 0.2);
            padding: 0.3rem 0.7rem;
            border-radius: 0.5rem;
            font-size: 0.8rem;
            color: #a5b4fc;
        }

        select {
            background: #0f172a;
            color: #818cf8;
            border: 1px solid var(--glass-border);
            padding: 0.4rem;
            border-radius: 0.5rem;
            font-size: 0.85rem;
            outline: none;
        }

        /* Modal */
        .modal {
            position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);
            display: none; align-items: center; justify-content: center; z-index: 1000;
        }

        .modal-content {
            background: #1e293b; width: 90%; max-width: 800px; padding: 2.5rem; border-radius: 2rem;
            border: 1px solid var(--glass-border);
        }

        textarea {
            width: 100%; height: 400px; background: #0f172a; color: #10b981; border: 1px solid var(--glass-border);
            border-radius: 1rem; padding: 1.5rem; font-family: 'Fira Code', monospace; font-size: 0.9rem;
            margin: 1.5rem 0; resize: none;
        }

        input {
            width: 100%; background: #0f172a; border: 1px solid var(--glass-border); color: white;
            padding: 1rem; border-radius: 0.8rem; margin-top: 0.5rem;
        }

        .loader {
            position: fixed; top: 0; left: 0; right: 0; height: 3px; background: var(--primary);
            box-shadow: 0 0 10px var(--primary); z-index: 2000; display: none;
            animation: pulse 2s infinite;
        }
        @keyframes pulse { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }

        pre {
            background: #0f172a;
            color: #10b981;
            padding: 1.5rem;
            border-radius: 1rem;
            overflow-x: auto;
            font-family: 'Fira Code', monospace;
            font-size: 0.85rem;
            border: 1px solid var(--glass-border);
        }
    </style>
</head>
<body>
    <div class="loader" id="loader"></div>
    
    <aside>
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
            <div style="color: var(--success); font-weight: 600;">● Online</div>
        </div>
    </aside>

    <main>
        <div class="header">
            <h1 id="section-title">Inventory & Registry</h1>
            <div style="display: flex; gap: 1rem;">
                <button class="btn btn-s" onclick="refreshData()">Sync Sync</button>
                <button class="btn btn-p" id="btn-create" style="display: none;" onclick="openCreateModal()">+ Create New</button>
            </div>
        </div>

        <div class="stats-grid">
            <div class="card"><div>Total Nodes</div><div class="stat-val" id="stat-nodes">0</div></div>
            <div class="card"><div>Active Groups</div><div class="stat-val" id="stat-groups">0</div></div>
            <div class="card"><div>KV Entries</div><div class="stat-val" id="stat-kv">0</div></div>
        </div>

        <!-- Section: Nodes -->
        <div id="section-nodes" class="section active">
            <div class="table-container">
                <table id="table-nodes">
                    <thead><tr><th>Hostname</th><th>Host Link</th><th>Group Assignment</th><th>Action</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>

        <!-- Section: Group Mapping -->
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

        <!-- Section: Templates -->
        <div id="section-templates" class="section">
            <div class="stats-grid" id="grid-templates"></div>
        </div>

        <!-- Section: Configs -->
        <div id="section-configs" class="section">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
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

        <!-- Section: System -->
        <div id="section-system" class="section">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
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

    <!-- Generic Modal -->
    <div class="modal" id="modal">
        <div class="modal-content">
            <h2 id="modal-title">Edit Configuration</h2>
            <div id="modal-key-input" style="display: none;">
                <label>Key Name (e.g. template:new-vps or cert:domain.com)</label>
                <input type="text" id="new-key-name" placeholder="Enter full key name...">
            </div>
            <div id="editor-container">
                <textarea id="editor"></textarea>
            </div>
            <div id="info-container" style="display: none;">
                <pre id="info-content"></pre>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem;">
                <button class="btn btn-s" onclick="closeModal()">Close</button>
                <button class="btn btn-p" id="modal-save-btn" onclick="saveData()">Update KV</button>
            </div>
        </div>
    </div>

    <script>
        const TOKEN = new URLSearchParams(window.location.search).get('token');
        let currentKey = '';
        let isNew = false;
        let groupsData = []; // Store central group mapping

        function showSection(id) {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.getElementById('section-' + id).classList.add('active');
            event.currentTarget.classList.add('active');
            document.getElementById('section-title').innerText = event.currentTarget.innerText;
            
            // Show create button for certain sections
            const btn = document.getElementById('btn-create');
            btn.style.display = (id === 'templates' || id === 'configs' || id === 'system') ? 'block' : 'none';
        }

        async function refreshData() {
            document.getElementById('loader').style.display = 'block';
            try {
                const res = await fetch(\`/api/data?token=\${TOKEN}\`);
                const data = await res.json();
                groupsData = data.groups || [];
                
                // Stats
                document.getElementById('stat-nodes').innerText = Object.keys(data.registry).length;
                document.getElementById('stat-groups').innerText = groupsData.length;
                document.getElementById('stat-kv').innerText = (data.templates.length + data.groupConfigs.length + data.nodeConfigs.length + data.certConfigs.length + (data.hasGlobal ? 1 : 0));

                // Helper to find group of a node
                const getGroupOf = (node) => {
                    const g = groupsData.find(g => (g.listnode || "").split(',').map(s=>s.trim()).includes(node));
                    return g ? g.config : "None";
                };

                // Nodes Registry
                const nBody = document.querySelector('#table-nodes tbody');
                nBody.innerHTML = '';
                for (const h in data.registry) {
                    const currentGroup = getGroupOf(h);
                    let groupOptions = '<option value="">(No Group)</option>';
                    groupsData.forEach(g => {
                        groupOptions += \`<option value="\${g.config}" \${g.config === currentGroup ? 'selected' : ''}>\${g.config}</option>\`;
                    });

                    nBody.innerHTML += \`<tr>
                        <td style="font-weight:600;">\${h}</td>
                        <td><span class="tag">\${data.registry[h]}</span></td>
                        <td>
                            <select onchange="updateNodeGroup('\${h}', this.value)">
                                \${groupOptions}
                            </select>
                        </td>
                        <td>
                            <div style="display:flex; gap: 0.5rem;">
                                <button class="btn btn-info" onclick="fetchNodeInfo('\${h}')">Info</button>
                                <button class="btn btn-s" onclick="editKV('node:\${h}')">Override</button>
                            </div>
                        </td>
                    </tr>\`;
                }

                // Group Mapping
                const mBody = document.querySelector('#table-mapping tbody');
                mBody.innerHTML = '';
                groupsData.forEach(g => {
                    mBody.innerHTML += \`<tr>
                        <td style="color:var(--accent);">\${g.config}</td>
                        <td style="font-size:0.85rem; opacity:0.8;">\${g.listnode}</td>
                        <td><button class="btn btn-s" onclick="editKV('group:\${g.config}')">Config</button></td>
                    </tr>\`;
                });

                // Templates
                const tGrid = document.getElementById('grid-templates');
                tGrid.innerHTML = '';
                data.templates.forEach(t => {
                    tGrid.innerHTML += \`<div class="card">
                        <div style="font-weight:600;">\${t.split(':')[1]}</div>
                        <div style="margin-top:1rem;"><button class="btn btn-s" onclick="editKV('\${t}')">Edit Script</button></div>
                    </div>\`;
                });

                // JSON Config Lists
                const gList = document.getElementById('list-group-configs');
                gList.innerHTML = '';
                data.groupConfigs.forEach(c => {
                    gList.innerHTML += \`<div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:1rem;">
                        <span>\${c}</span><button class="btn btn-s" onclick="editKV('\${c}')">Edit</button>
                    </div>\`;
                });

                const nodeC = document.getElementById('list-node-configs');
                nodeC.innerHTML = '';
                data.nodeConfigs.forEach(c => {
                    nodeC.innerHTML += \`<div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:1rem;">
                        <span>\${c}</span><button class="btn btn-s" onclick="editKV('\${c}')">Edit</button>
                    </div>\`;
                });

                // System Section
                const gArea = document.getElementById('global-config-area');
                gArea.innerHTML = data.hasGlobal ? \`
                    <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                        <span>global.json</span>
                        <button class="btn btn-p" onclick="editKV('global')">Configure</button>
                    </div>
                \` : '<p style="opacity:0.5;">No global configuration found.</p>';

                const cList = document.getElementById('list-cert-configs');
                cList.innerHTML = '';
                data.certConfigs.forEach(c => {
                    cList.innerHTML += \`<div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:1rem;">
                        <span>\${c}</span><button class="btn btn-s" onclick="editKV('\${c}')">Edit</button>
                    </div>\`;
                });

            } catch (e) { alert('Unauthorized or Network Error'); }
            document.getElementById('loader').style.display = 'none';
        }

        async function fetchNodeInfo(hostname) {
            document.getElementById('loader').style.display = 'block';
            try {
                const res = await fetch(\`/api/node-proxy?token=\${TOKEN}&hostname=\${hostname}&endpoint=nodeinfo\`);
                const data = await res.text();
                
                document.getElementById('modal-title').innerText = \`Node Info: \${hostname}\`;
                document.getElementById('modal-key-input').style.display = 'none';
                document.getElementById('editor-container').style.display = 'none';
                document.getElementById('info-container').style.display = 'block';
                document.getElementById('modal-save-btn').style.display = 'none';
                
                let output = data;
                try {
                    // Try to format if it's JSON
                    output = JSON.stringify(JSON.parse(data), null, 2);
                } catch(e) {}
                
                document.getElementById('info-content').innerText = output;
                document.getElementById('modal').style.display = 'flex';
            } catch (e) {
                alert('Error fetching node info');
            }
            document.getElementById('loader').style.display = 'none';
        }

        async function updateNodeGroup(hostname, newGroupName) {
            document.getElementById('loader').style.display = 'block';
            
            // 1. Clone groupsData to modify
            const updatedGroups = groupsData.map(g => {
                // Remove hostname from current lists
                let nodes = (g.listnode || "").split(',').map(s=>s.trim()).filter(s => s && s !== hostname);
                
                // Add to new group if matched
                if (g.config === newGroupName) {
                    nodes.push(hostname);
                }
                
                return { ...g, listnode: nodes.join(',') };
            });

            // 2. Save to KV
            try {
                const res = await fetch(\`/api/save?token=\${TOKEN}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'groups', value: JSON.stringify(updatedGroups, null, 2) })
                });
                if (res.ok) {
                    refreshData();
                } else alert('Failed to assign group');
            } catch (e) { alert('Error saving group mapping'); }
            document.getElementById('loader').style.display = 'none';
        }

        async function editKV(key) {
            currentKey = key;
            isNew = false;
            document.getElementById('modal-title').innerText = 'Editing ' + key;
            document.getElementById('modal-key-input').style.display = 'none';
            document.getElementById('editor-container').style.display = 'block';
            document.getElementById('info-container').style.display = 'none';
            document.getElementById('modal-save-btn').style.display = 'block';
            document.getElementById('loader').style.display = 'block';
            try {
                const res = await fetch(\`/api/get-kv?token=\${TOKEN}&key=\${key}\`);
                document.getElementById('editor').value = await res.text();
                document.getElementById('modal').style.display = 'flex';
            } catch (e) { alert('Error fetching KV'); }
            document.getElementById('loader').style.display = 'none';
        }

        function openCreateModal() {
            currentKey = '';
            isNew = true;
            document.getElementById('modal-title').innerText = 'Create New Configuration';
            document.getElementById('modal-key-input').style.display = 'block';
            document.getElementById('editor-container').style.display = 'block';
            document.getElementById('info-container').style.display = 'none';
            document.getElementById('modal-save-btn').style.display = 'block';
            document.getElementById('new-key-name').value = '';
            document.getElementById('editor').value = '{}';
            document.getElementById('modal').style.display = 'flex';
        }

        async function saveData() {
            const key = isNew ? document.getElementById('new-key-name').value : currentKey;
            const value = document.getElementById('editor').value;
            if (!key) return alert('Key name is required');

            document.getElementById('loader').style.display = 'block';
            try {
                const res = await fetch(\`/api/save?token=\${TOKEN}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key, value })
                });
                if (res.ok) {
                    closeModal();
                    refreshData();
                } else alert('Save failed');
            } catch (e) { alert('Error saving KV'); }
            document.getElementById('loader').style.display = 'none';
        }

        function closeModal() { document.getElementById('modal').style.display = 'none'; }

        if (!TOKEN) {
            document.body.innerHTML = '<div style="margin:auto; text-align:center;"><h1>401 UNAUTHORIZED</h1><p>Vui lòng đăng nhập bằng Token qua URL.</p></div>';
        } else {
            refreshData();
        }
    </script>
</body>
</html>
\`;
