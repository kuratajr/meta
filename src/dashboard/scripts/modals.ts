// @ts-nocheck
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
    if (mode === 'confirm' && onConfirm) document.getElementById('modal-confirm-action-btn').onclick = () => { onConfirm(); closeModal(); };
    if (mode === 'info' && content) document.getElementById('info-content').innerText = content;
    document.getElementById('modal').style.display = 'flex';
}

function closeModal() { document.getElementById('modal').style.display = 'none'; }

async function editKV(k) {
    currentKey = k; isNew = false;
    showModal({ title: 'Edit ' + k, mode: 'editor' });
    document.getElementById('loader').style.display = 'block';
    try {
        const res = await fetch(`/api/get-kv?token=${TOKEN}&key=${k}`);
        document.getElementById('modal-textarea').value = await res.text();
    } catch (e) { }
    document.getElementById('loader').style.display = 'none';
}

async function saveContent() {
    const val = document.getElementById('modal-textarea').value;
    document.getElementById('loader').style.display = 'block';
    try {
        await fetch(`/api/save?token=${TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: currentKey, value: val })
        });
        closeModal(); refreshData();
    } catch (e) { }
    document.getElementById('loader').style.display = 'none';
}

async function deleteKV(key) {
    showModal({
        title: 'Delete Key', message: `Delete key "${key}"?`, mode: 'confirm',
        onConfirm: async () => {
            document.getElementById('loader').style.display = 'block';
            try {
                const res = await fetch(`/api/delete?token=${TOKEN}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
                const data = await res.json();
                if (data.success) { showToast("Deleted!"); refreshData(); }
            } catch (e) { }
            document.getElementById('loader').style.display = 'none';
        }
    });
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
            showToast("Action requested!");
        } catch (e) { showToast("Action failed!"); }
        document.getElementById('loader').style.display = 'none';
    };
    if (['start', 'stop', 'reboot', 'destroy'].includes(a)) {
        showModal({ title: `Confirm ${a.toUpperCase()}`, message: `Are you sure you want to ${a} node ${h}?`, mode: 'confirm', onConfirm: executeAction });
    } else executeAction();
}

async function copyToClipboard(text) { try { await navigator.clipboard.writeText(text); showToast("Copied!"); } catch (err) { } }
function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg; t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 2000);
}
