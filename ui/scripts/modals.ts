// @ts-nocheck
if (typeof window !== 'undefined') {
    window.showModal = function ({ title, message, content, mode, onConfirm }) {
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
        if (mode === 'confirm' && onConfirm) document.getElementById('modal-confirm-action-btn').onclick = () => { onConfirm(); window.closeModal(); };
        if (mode === 'info' && content) document.getElementById('info-content').innerText = content;
        document.getElementById('modal').style.display = 'flex';
    };

    window.closeModal = function () { document.getElementById('modal').style.display = 'none'; };

    window.editKV = async function (k) {
        window.currentKey = k; window.isNew = false;
        window.showModal({ title: 'Edit ' + k, mode: 'editor' });
        document.getElementById('loader').style.display = 'block';
        try {
            const res = await fetch(`/api/get-kv?token=${window.TOKEN}&key=${k}`);
            document.getElementById('modal-textarea').value = await res.text();
        } catch (e) { }
        document.getElementById('loader').style.display = 'none';
    };

    window.saveContent = async function () {
        const val = document.getElementById('modal-textarea').value;
        document.getElementById('loader').style.display = 'block';
        try {
            await fetch(`/api/save?token=${window.TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: window.currentKey, value: val })
            });
            window.closeModal(); window.refreshData();
        } catch (e) { }
        document.getElementById('loader').style.display = 'none';
    };

    window.deleteKV = async function (key) {
        window.showModal({
            title: 'Delete Key', message: `Delete key "${key}"?`, mode: 'confirm',
            onConfirm: async () => {
                document.getElementById('loader').style.display = 'block';
                try {
                    const res = await fetch(`/api/delete?token=${window.TOKEN}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
                    const data = await res.json();
                    if (data.success) { window.showToast("Deleted!"); window.refreshData(); }
                } catch (e) { }
                document.getElementById('loader').style.display = 'none';
            }
        });
    };

    window.fetchNodeInfo = async function (h) {
        document.getElementById('loader').style.display = 'block';
        try {
            const res = await fetch(`/api/node-proxy?token=${window.TOKEN}&hostname=${h}&endpoint=nodeinfo`);
            const raw = await res.text();
            let display = raw;
            try { display = JSON.stringify(JSON.parse(raw), null, 4); } catch (e) { }
            window.showModal({ title: `Node Info: ${h}`, content: display, mode: 'info' });
        } catch (e) { window.showModal({ title: 'Error', message: 'Failed to fetch node info.', mode: 'alert' }); }
        document.getElementById('loader').style.display = 'none';
    };

    window.runNodeAction = async function (h, a) {
        const executeAction = async () => {
            document.getElementById('loader').style.display = 'block';
            try {
                await fetch(`/api/node-proxy?token=${window.TOKEN}&hostname=${h}&endpoint=${a}`);
                window.showToast("Action requested!");
            } catch (e) { window.showToast("Action failed!"); }
            document.getElementById('loader').style.display = 'none';
        };
        if (['start', 'stop', 'reboot', 'destroy'].includes(a)) {
            window.showModal({ title: `Confirm ${a.toUpperCase()}`, message: `Are you sure you want to ${a} node ${h}?`, mode: 'confirm', onConfirm: executeAction });
        } else executeAction();
    };

    window.copyToClipboard = async function (text) { try { await navigator.clipboard.writeText(text); window.showToast("Copied!"); } catch (err) { } };

    window.showToast = function (msg) {
        const t = document.getElementById('toast');
        t.innerText = msg; t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 2000);
    };
}
