export const DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>METALink | VPS Management</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&family=Ubuntu+Mono&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
    <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js"></script>
    <style>
        :root {
            --primary: #6366f1;
            --primary-glow: rgba(99, 102, 241, 0.4);
            --bg: #0b0f1a;
            --glass: rgba(17, 25, 40, 0.75);
            --glass-border: rgba(255, 255, 255, 0.08);
            --text: #f8fafc;
            --text-dim: #94a3b8;
            --success: #10b981;
            --danger: #ef4444;
            --accent: #818cf8;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
        body { background: var(--bg); color: var(--text); min-height: 100vh; display: flex; overflow-x: hidden; }

        aside {
            width: 270px; background: rgba(11, 15, 26, 0.9); backdrop-filter: blur(20px);
            border-right: 1px solid var(--glass-border); padding: 2.5rem 1.5rem;
            display: flex; flex-direction: column; gap: 2.5rem; position: fixed; height: 100vh; z-index: 1000;
            transition: transform 0.4s ease;
        }
        .logo-text { font-size: 1.25rem; font-weight: 600; background: linear-gradient(to right, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

        .nav-item { padding: 0.8rem 1rem; border-radius: 12px; cursor: pointer; color: var(--text-dim); display: flex; align-items: center; gap: 0.8rem; transition: 0.3s; }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: white; }
        .nav-item.active { background: rgba(99, 102, 241, 0.1); color: white; border: 1px solid rgba(99, 102, 241, 0.2); }

        main { margin-left: 270px; flex: 1; padding: 3rem; max-width: 1500px; transition: 0.4s; }

        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
        .card { background: var(--glass); border: 1px solid var(--glass-border); border-radius: 20px; padding: 1.5rem; }
        .stat-label { color: var(--text-dim); font-size: 0.8rem; text-transform: uppercase; margin-bottom: 0.5rem; }
        .stat-value { font-size: 2rem; font-weight: 600; }

        .section { display: none; }
        .section.active { display: block; }

        .panel { background: var(--glass); border: 1px solid var(--glass-border); border-radius: 24px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th { background: rgba(0,0,0,0.2); padding: 1.2rem 1.5rem; text-align: left; font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase; border-bottom: 1px solid var(--glass-border); }
        td { padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--glass-border); font-size: 0.9rem; }

        .btn { padding: 0.5rem 0.8rem; border-radius: 10px; border: 1px solid transparent; cursor: pointer; font-weight: 600; font-size: 0.8rem; transition: 0.2s; display: inline-flex; align-items: center; gap: 0.4rem; color: white; }
        .btn-p { background: var(--primary); }
        .btn-s { background: rgba(255,255,255,0.05); border-color: var(--glass-border); }
        .btn-danger { background: rgba(239, 68, 68, 0.1); color: #fca5a5; }

        .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 0.5rem; }
        .dot.online { background: var(--success); box-shadow: 0 0 10px var(--success); }
        .dot.offline { background: var(--danger); }

        #section-terminal { height: calc(100vh - 120px); }
        .terminal-box { height: 100%; display: flex; flex-direction: column; background: #000; border-radius: 20px; border: 1px solid var(--glass-border); overflow: hidden; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); display: none; align-items: center; justify-content: center; z-index: 2000; }
        .modal { background: #1a1f2e; border: 1px solid var(--glass-border); border-radius: 24px; width: 100%; max-width: 800px; padding: 2rem; }
        textarea { width: 100%; height: 400px; background: #000; color: #10b981; border: 1px solid var(--glass-border); border-radius: 12px; padding: 1rem; font-family: monospace; outline: none; margin: 1rem 0; }
        #toast { position: fixed; bottom: 2rem; right: 2rem; background: var(--primary); padding: 1rem 2rem; border-radius: 12px; display: none; z-index: 5000; }

        @media (max-width: 1024px) { aside { transform: translateX(-100%); } main { margin-left: 0; } }
    </style>
</head>
<body>
    <div id="toast">Copied!</div>
    <aside id="sidebar">
        <div class="logo-text">METALink VPS</div>
        <div class="nav-item active" onclick="showSection('nodes')">Inventory</div>
        <div class="nav-item" onclick="showSection('groups')">Groups</div>
        <div class="nav-item" onclick="showSection('logs')">Logs</div>
    </aside>

    <main>
        <div class="header">
            <div><h1 id="h-title">Inventory</h1></div>
            <div style="display:flex; gap:1rem">
                <button class="btn btn-s" onclick="toggleAutoRefresh()" id="btn-live">Auto-Sync: Off</button>
                <button class="btn btn-p" onclick="refreshData()">Sync Data</button>
            </div>
        </div>

        <div class="stats-grid" id="stats-area">
            <div class="card"><div class="stat-label">Total Nodes</div><div class="stat-value" id="stat-n">0</div></div>
            <div class="card"><div class="stat-label">Mappings</div><div class="stat-value" id="stat-g">0</div></div>
        </div>

        <div id="section-nodes" class="section active">
            <div class="panel"><table><thead><tr><th>Node</th><th>Address</th><th style="text-align:right">Actions</th></tr></thead><tbody id="node-body"></tbody></table></div>
        </div>

        <div id="section-groups" class="section">
            <div class="panel"><table><thead><tr><th>Group</th><th>Nodes</th><th style="text-align:right">Actions</th></tr></thead><tbody id="group-body"></tbody></table></div>
        </div>

        <div id="section-logs" class="section">
            <div class="panel" style="background:#000; padding:1.5rem; color:#10b981; height:600px; overflow-y:auto; font-family:monospace" id="log-body"></div>
        </div>

        <div id="section-terminal" class="section">
            <div class="terminal-box">
                <div style="padding:1rem; border-bottom:1px solid #222; display:flex; justify-content:space-between">
                    <button class="btn btn-s" onclick="showSection('nodes')">Back</button>
                    <div id="term-h">Terminal</div>
                    <div id="term-s">Connecting...</div>
                </div>
                <div id="xterm-container" style="flex:1; padding:1rem"></div>
            </div>
        </div>
    </main>

    <div class="modal-overlay" id="modal-overlay">
        <div class="modal"><h2 id="m-title">Edit</h2><textarea id="m-editor"></textarea>
        <div style="text-align:right"><button class="btn btn-s" onclick="closeModal()">Close</button><button class="btn btn-p" id="m-save">Save</button></div></div>
    </div>

    <script>
    (function() {
        const TOKEN = new URLSearchParams(window.location.search).get('token');
        let lastData = null, statuses = {}, timer = 30, interval = null;

        window.showSection = (id) => {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById('section-'+id).classList.add('active');
            document.getElementById('h-title').innerText = id.toUpperCase();
            document.getElementById('stats-area').style.display = id === 'terminal' ? 'none' : 'grid';
            if (id === 'logs') fetchLogs();
        };

        window.refreshData = async () => {
            if (!TOKEN) return;
            const res = await fetch(\`/api/data?token=\${TOKEN}\`);
            lastData = await res.json();
            renderUI();
            const sRes = await fetch(\`/api/batch-check-nodes?token=\${TOKEN}&limit=100\`);
            statuses = await sRes.json();
            renderNodes();
        };

        function renderUI() {
            document.getElementById('stat-n').innerText = Object.keys(lastData.registry).length;
            document.getElementById('stat-g').innerText = lastData.groups.length;
            renderNodes();
            renderGroups();
        }

        function renderNodes() {
            const body = document.getElementById('node-body');
            body.innerHTML = Object.keys(lastData.registry).map(h => {
                const online = statuses[h] === true;
                return \`<tr><td><div class="dot \${online?'online':'offline'}"></div>\${h}</td><td>\${lastData.registry[h]}</td><td style="text-align:right">
                    <button class="btn btn-s" onclick="openTerminal('\${h}')">Term</button>
                    <button class="btn btn-s" onclick="editKV('node:\${h}')">Edit</button>
                    <button class="btn btn-p" onclick="nodeOp('\${h}','start')">Start</button>
                </td></tr>\`;
            }).join('');
        }

        function renderGroups() {
            const body = document.getElementById('group-body');
            body.innerHTML = lastData.groups.map(g => \`<tr><td>\${g.config}</td><td>\${g.listnode||''}</td><td style="text-align:right"><button class="btn btn-s" onclick="editKV('group:\${g.config}')">Edit</button></td></tr>\`).join('');
        }

        window.fetchLogs = async () => {
            const res = await fetch(\`/api/logs?token=\${TOKEN}&limit=50\`);
            const logs = await res.json();
            document.getElementById('log-body').innerHTML = logs.map(l => \`<div>[\${l.time}] \${l.node||'SYS'}: \${l.msg}</div>\`).join('');
        };

        window.nodeOp = async (h, op) => {
            await fetch(\`/api/node-proxy?token=\${TOKEN}&hostname=\${h}&endpoint=\${op}\`);
            alert("Action sent: " + op);
        };

        let term, ws;
        window.openTerminal = (h) => {
            showSection('terminal');
            document.getElementById('term-h').innerText = h;
            const container = document.getElementById('xterm-container');
            container.innerHTML = '';
            term = new Terminal({ theme: { background: 'transparent' } });
            const fit = new FitAddon.FitAddon();
            term.loadAddon(fit);
            term.open(container);
            fit.fit();
            const proto = location.protocol==='https:'?'wss:':'ws:';
            ws = new WebSocket(\`\${proto}//\${location.host}/terminal-proxy/\${TOKEN}/\${h}/ws\`, 'tty');
            ws.binaryType = 'arraybuffer';
            ws.onopen = () => { document.getElementById('term-s').innerText='Online'; ws.send(JSON.stringify({columns:term.cols, rows:term.rows})); };
            const decoder = new TextDecoder();
            ws.onmessage = (e) => {
                let m = typeof e.data==='string'?e.data:decoder.decode(new Uint8Array(e.data));
                if (m.startsWith('0')) term.write(m.slice(1)); else if (!/^[12]/.test(m)) term.write(m);
            };
            term.onData(d => ws?.readyState===1 && ws.send('0'+d));
        };

        window.editKV = async (k) => {
            document.getElementById('modal-overlay').style.display='flex';
            document.getElementById('m-editor').value = "Loading...";
            const res = await fetch(\`/api/get-kv?token=\${TOKEN}&key=\${k}\`);
            document.getElementById('m-editor').value = await res.text();
            document.getElementById('m-save').onclick = async () => {
                await fetch(\`/api/save?token=\${TOKEN}\`, { method:'POST', body: JSON.stringify({key:k, value:document.getElementById('m-editor').value}) });
                closeModal(); refreshData();
            };
        };
        window.closeModal = () => document.getElementById('modal-overlay').style.display='none';

        window.toggleAutoRefresh = () => {
            if (interval) { clearInterval(interval); interval=null; document.getElementById('btn-live').innerText="Auto-Sync: Off"; }
            else { interval = setInterval(() => { timer--; if(timer<=0){ refreshData(); timer=30; } document.getElementById('btn-live').innerText=\`Sync in \${timer}s\`; }, 1000); }
        };

        if (TOKEN) refreshData();
    })();
    </script>
</body>
</html>
`;