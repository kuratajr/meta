export const DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VPS Cloud Management</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #6366f1;
            --primary-glow: rgba(99, 102, 241, 0.4);
            --bg: #0f172a;
            --glass: rgba(30, 41, 59, 0.7);
            --text: #f8fafc;
            --success: #22c55e;
            --danger: #ef4444;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Outfit', sans-serif;
        }

        body {
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%);
            color: var(--text);
            min-height: 100vh;
            padding: 2rem;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .container {
            width: 100%;
            max-width: 1200px;
            z-index: 1;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            background: var(--glass);
            backdrop-filter: blur(12px);
            padding: 1.5rem 2rem;
            border-radius: 1.5rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .logo {
            font-size: 1.5rem;
            font-weight: 600;
            background: linear-gradient(to right, #818cf8, #c084fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .stat-card {
            background: var(--glass);
            backdrop-filter: blur(12px);
            padding: 1.5rem;
            border-radius: 1.5rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: transform 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            border-color: var(--primary);
        }

        .stat-value {
            font-size: 2rem;
            font-weight: 600;
            margin-top: 0.5rem;
        }

        .section {
            background: var(--glass);
            backdrop-filter: blur(12px);
            padding: 2rem;
            border-radius: 1.5rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            margin-bottom: 2rem;
        }

        h2 { margin-bottom: 1.5rem; font-weight: 400; opacity: 0.9; }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th { text-align: left; padding: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; }
        td { padding: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }

        .btn {
            padding: 0.6rem 1.2rem;
            border-radius: 0.8rem;
            border: none;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s ease;
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 0.05em;
        }

        .btn-primary { background: var(--primary); color: white; box-shadow: 0 4px 14px var(--primary-glow); }
        .btn-primary:hover { filter: brightness(1.2); }

        .btn-ghost { background: transparent; border: 1px solid rgba(255, 255, 255, 0.2); color: white; }
        .btn-ghost:hover { background: rgba(255, 255, 255, 0.1); }

        .modal {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 100;
        }

        .modal-content {
            background: #1e293b;
            padding: 2.5rem;
            border-radius: 2rem;
            width: 90%;
            max-width: 600px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        textarea {
            width: 100%;
            height: 300px;
            background: #0f172a;
            color: #10b981;
            padding: 1rem;
            border-radius: 1rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            font-family: monospace;
            margin: 1.5rem 0;
            resize: none;
        }

        .loading {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 4px;
            background: var(--primary);
            animation: load 2s infinite linear;
            display: none;
        }

        @keyframes load {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }

        .tag {
            padding: 0.2rem 0.6rem;
            border-radius: 0.5rem;
            background: rgba(99, 102, 241, 0.2);
            font-size: 0.85rem;
            margin-right: 0.5rem;
        }
    </style>
</head>
<body>
    <div class="loading" id="loader"></div>
    <div class="container" id="app">
        <header>
            <div class="logo">VPS METALINK DASHBOARD</div>
            <div class="actions">
                <button class="btn btn-ghost" onclick="fetchData()">Refresh</button>
            </div>
        </header>

        <div class="stats-grid">
            <div class="stat-card">
                <div>Active Nodes</div>
                <div class="stat-value" id="count-nodes">...</div>
            </div>
            <div class="stat-card">
                <div>Groups</div>
                <div class="stat-value" id="count-groups">...</div>
            </div>
            <div class="stat-card">
                <div>Templates</div>
                <div class="stat-value">Cloud-Init</div>
            </div>
        </div>

        <div class="section">
            <h2>Registry (Active Hosts)</h2>
            <table id="table-registry">
                <thead>
                    <tr>
                        <th>Node Name</th>
                        <th>Registered Host</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>

        <div class="section">
            <h2>Group Mappings (groups)</h2>
            <div id="group-list" style="display: flex; flex-wrap: wrap; gap: 1rem;"></div>
            <div style="margin-top: 1.5rem;">
               <button class="btn btn-primary" onclick="editMapping()">Edit All Group Mappings</button>
            </div>
        </div>
    </div>

    <!-- Edit Modal -->
    <div class="modal" id="modal">
        <div class="modal-content">
            <h3 id="modal-title">Edit Configuration</h3>
            <textarea id="modal-editor"></textarea>
            <div style="display: flex; justify-content: flex-end; gap: 1rem;">
                <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveData()">Save Changes</button>
            </div>
        </div>
    </div>

    <script>
        const TOKEN = new URLSearchParams(window.location.search).get('token');
        let currentPath = '';

        async function fetchData() {
            document.getElementById('loader').style.display = 'block';
            try {
                const res = await fetch(\`/api/data?token=\${TOKEN}\`);
                const data = await res.json();
                
                // Update Counts
                document.getElementById('count-nodes').innerText = Object.keys(data.registry || {}).length;
                document.getElementById('count-groups').innerText = data.groups?.length || 0;

                // Update Registry Table
                const regBody = document.querySelector('#table-registry tbody');
                regBody.innerHTML = '';
                for (const node in data.registry) {
                    regBody.innerHTML += \`<tr>
                        <td>\${node}</td>
                        <td><span class="tag">\${data.registry[node]}</span></td>
                        <td>
                             <button class="btn btn-ghost" onclick="editKV('node:\${node}')">Config</button>
                        </td>
                    </tr>\`;
                }

                // Update Group List
                const groupList = document.getElementById('group-list');
                groupList.innerHTML = '';
                (data.groups || []).forEach(g => {
                    groupList.innerHTML += \`<div class="stat-card" style="flex: 1; min-width: 250px;">
                        <div style="font-weight: 600; margin-bottom: 0.5rem; color: #818cf8;">\${g.config}</div>
                        <div style="font-size: 0.9rem; opacity: 0.7;">\${g.listnode}</div>
                        <div style="margin-top: 1rem;">
                            <button class="btn btn-ghost" onclick="editKV('group:\${g.config}')">Edit Config</button>
                        </div>
                    </div>\`;
                });

            } catch (e) {
                alert('Load failed. Check token or connection.');
            }
            document.getElementById('loader').style.display = 'none';
        }

        function editKV(key) {
            currentPath = key;
            document.getElementById('modal-title').innerText = \`Editing \${key}\`;
            document.getElementById('loader').style.display = 'block';
            fetch(\`/api/get-kv?token=\${TOKEN}&key=\${key}\`)
                .then(r => r.text())
                .then(txt => {
                    document.getElementById('modal-editor').value = txt;
                    document.getElementById('modal').style.display = 'flex';
                })
                .finally(() => document.getElementById('loader').style.display = 'none');
        }

        function editMapping() {
             currentPath = 'groups';
             document.getElementById('modal-title').innerText = 'Editing Central Group Mapping';
             document.getElementById('loader').style.display = 'block';
             fetch(\`/api/get-kv?token=\${TOKEN}&key=groups\`)
                .then(r => r.text())
                .then(txt => {
                    document.getElementById('modal-editor').value = txt;
                    document.getElementById('modal').style.display = 'flex';
                })
                .finally(() => document.getElementById('loader').style.display = 'none');
        }

        async function saveData() {
            const content = document.getElementById('modal-editor').value;
            document.getElementById('loader').style.display = 'block';
            try {
                const res = await fetch(\`/api/save?token=\${TOKEN}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: currentPath, value: content })
                });
                if (res.ok) {
                    closeModal();
                    fetchData();
                } else {
                    alert('Save failed');
                }
            } catch (e) {
                alert('Error saving data');
            }
            document.getElementById('loader').style.display = 'none';
        }

        function closeModal() { document.getElementById('modal').style.display = 'none'; }

        if (!TOKEN) {
            document.body.innerHTML = '<h1>ACCESS DENIED</h1><p>Vui lòng cung cấp Admin Token qua URL (?token=...)</p>';
        } else {
            fetchData();
        }
    </script>
</body>
</html>
`;
