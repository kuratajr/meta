// @ts-nocheck
if (typeof window !== 'undefined') {
    window.refreshData = async function () {
        if (!window.TOKEN) { document.getElementById('auth-warning').style.display = 'block'; return; }
        document.getElementById('loader').style.display = 'block';
        try {
            const res = await fetch(`/api/data?token=${window.TOKEN}`);
            const data = await res.json();
            window.lastData = data;
            window.renderUI(data);
            if (window.lucide) lucide.createIcons();
        } catch (e) {
            console.error(e);
        }
        document.getElementById('loader').style.display = 'none';
    };

    window.handleSearch = function (event) {
        window.currentSearch = event.target.value.toLowerCase();
        if (!window.lastData) return;
        window.renderUI(window.lastData);
    };

    window.renderUI = function (data) {
        window.groupsData = data.groups || [];
        document.getElementById('stat-total-nodes').innerText = Object.keys(data.registry).length;
        document.getElementById('stat-active-groups').innerText = window.groupsData.length;
        document.getElementById('stat-total-kv').innerText = (data.templates.length + data.groupConfigs.length + data.nodeConfigs.length + data.certConfigs.length + (data.hasGlobal ? 1 : 0));

        window.renderNodes(data);
        window.renderGroups(data);
        window.renderTemplates(data);
        window.renderConfigs(data);
    };

    const getGroupOf = (node) => {
        const g = window.groupsData.find(g => (g.listnode || "").split(',').map(s => s.trim()).includes(node));
        return g ? g.config : "None";
    };

    window.renderNodes = function (data) {
        const nBody = document.getElementById('nodes-table-body');
        let html = '';
        for (const h in data.registry) {
            const regVal = data.registry[h];
            const currentGroup = getGroupOf(h);
            if (window.currentSearch && !h.toLowerCase().includes(window.currentSearch) && !regVal.toLowerCase().includes(window.currentSearch) && !currentGroup.toLowerCase().includes(window.currentSearch)) continue;

            let groupOptions = '<option value="">None</option>';
            window.groupsData.forEach(g => { groupOptions += `<option value="${g.config}" ${g.config === currentGroup ? 'selected' : ''}>${g.config}</option>`; });

            html += `<tr data-status="${window.previousStatuses[h] === true ? 'online' : (window.previousStatuses[h] === false ? 'offline' : '')}">
                <td style="font-weight:600;"><span class="status-dot" data-node="${h}"></span>${h}</td>
                <td class="copyable" onclick="copyToClipboard('${regVal}')">${regVal}</td>
                <td><select onchange="updateNodeGroup('${h}', this.value)">${groupOptions}</select></td>
                <td>
                    <div class="action-flex">
                        <button class="btn btn-s" onclick="editKV('node:${h}')"><i data-lucide="settings"></i>Config</button>
                        <button class="btn btn-p" onclick="runNodeAction('${h}', 'start')"><i data-lucide="play"></i>Start</button>
                        <div class="dropdown">
                            <button class="btn btn-s dropdown-trigger" onclick="toggleDropdown(event)">More</button>
                            <div class="dropdown-content">
                                <div class="dropdown-item" onclick="openTerminal('${h}', '${regVal}')"><i data-lucide="terminal"></i>Terminal</div>
                                <div class="dropdown-item" onclick="fetchNodeInfo('${h}')"><i data-lucide="info"></i>Info</div>
                                <div class="dropdown-item" onclick="viewNodeLogs('${h}')"><i data-lucide="align-left"></i>Logs</div>
                                <div class="dropdown-item" onclick="runNodeAction('${h}', 'stop')"><i data-lucide="square"></i>Stop</div>
                                <div class="dropdown-item" onclick="runNodeAction('${h}', 'reboot')"><i data-lucide="refresh-cw"></i>Reboot</div>
                                <div class="dropdown-divider"></div>
                                <div class="dropdown-item" style="color:var(--danger);" onclick="deleteFromRegistry('${h}')"><i data-lucide="trash-2"></i>Delete Registry</div>
                                <div class="dropdown-item" style="color:var(--danger);" onclick="runNodeAction('${h}', 'destroy')"><i data-lucide="zap"></i>Destroy VPS</div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>`;
        }
        nBody.innerHTML = html || '<tr><td colspan="4" style="text-align:center; padding:3rem;">No nodes found.</td></tr>';
        window.refreshStatusDots();
    };

    window.renderGroups = function (data) {
        const gBody = document.getElementById('groups-table-body');
        if (!gBody) return;
        gBody.innerHTML = (data.groups || []).filter(g => !window.currentSearch || g.config.toLowerCase().includes(window.currentSearch)).map(g => `<tr>
            <td style="font-weight:600;">${g.config}</td>
            <td>${(g.listnode || '').split(',').filter(s => s.trim()).length} Nodes</td>
            <td><span class="badge badge-accent">Synchronized</span></td>
            <td>
                <div class="action-flex">
                    <button class="btn btn-s" onclick="editKV('group:${g.config}')"><i data-lucide="edit-3"></i>Edit Mapping</button>
                    <button class="btn btn-danger" onclick="deleteKV('group:${g.config}')"><i data-lucide="trash"></i>Delete</button>
                </div>
            </td>
        </tr>`).join('') || '<tr><td colspan="4" style="text-align:center; padding:3rem;">No groups defined.</td></tr>';
    };

    window.renderTemplates = function (data) {
        const tBody = document.getElementById('templates-table-body');
        if (!tBody) return;
        tBody.innerHTML = data.templates.filter(t => !window.currentSearch || t.toLowerCase().includes(window.currentSearch)).map(t => `<tr>
            <td style="font-weight:600;">${t.replace('template:', '')}</td>
            <td><span class="badge badge-accent">Shell Script</span></td>
            <td>Recently</td>
            <td>
                <div class="action-flex">
                    <button class="btn btn-s" onclick="editKV('${t}')"><i data-lucide="edit-3"></i>Edit Content</button>
                    <button class="btn btn-danger" onclick="deleteKV('${t}')"><i data-lucide="trash"></i>Delete</button>
                </div>
            </td>
        </tr>`).join('') || '<tr><td colspan="4" style="text-align:center; padding:3rem;">No templates found.</td></tr>';
    };

    window.renderConfigs = function (data) {
        const cBody = document.getElementById('configs-table-body');
        if (!cBody) return;
        const allConfigs = [...data.groupConfigs, ...data.nodeConfigs, ...data.certConfigs];
        cBody.innerHTML = allConfigs.filter(c => !window.currentSearch || c.toLowerCase().includes(window.currentSearch)).map(c => `<tr>
            <td style="font-weight:600;">${c}</td>
            <td>${c.startsWith('group:') ? 'Group' : (c.startsWith('node:') ? 'Node' : 'Cert')}</td>
            <td>JSON</td>
            <td>
                <div class="action-flex">
                    <button class="btn btn-s" onclick="editKV('${c}')"><i data-lucide="edit-3"></i>Edit JSON</button>
                    <button class="btn btn-danger" onclick="deleteKV('${c}')"><i data-lucide="trash"></i>Delete</button>
                </div>
            </td>
        </tr>`).join('') || '<tr><td colspan="4" style="text-align:center; padding:3rem;">No KV configs found.</td></tr>';
    };

    window.refreshStatusDots = async function () {
        if (!window.lastData || !window.lastData.registry) return;
        const hostnames = Object.keys(window.lastData.registry);
        const batchSize = 40;
        const total = hostnames.length;
        const promises = [];
        for (let i = 0; i < total; i += batchSize) {
            promises.push(fetch(`/api/batch-check-nodes?token=${window.TOKEN}&offset=${i}&limit=${batchSize}&_=${Date.now()}`).then(r => r.json()).catch(() => ({})));
        }
        try {
            const results = await Promise.all(promises);
            const allStatuses = Object.assign({}, ...results);
            for (const node of hostnames) {
                const newStatus = allStatuses[node];
                const prevStatus = window.previousStatuses[node];
                if (prevStatus !== undefined && newStatus !== prevStatus) {
                    const msg = `Node [${node}] is now ${newStatus ? 'ONLINE' : 'OFFLINE'}`;
                    fetch(`/api/record-log?token=${window.TOKEN}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msg, node }) }).catch(() => { });
                }
                window.previousStatuses[node] = newStatus;
            }
            document.querySelectorAll('.status-dot').forEach(dot => {
                const node = dot.getAttribute('data-node');
                const row = dot.closest('tr');
                if (allStatuses[node] === true) { dot.className = 'status-dot online'; if (row) row.setAttribute('data-status', 'online'); }
                else if (allStatuses[node] === false) { dot.className = 'status-dot offline'; if (row) row.setAttribute('data-status', 'offline'); }
            });
        } catch (e) { }
    };
}
