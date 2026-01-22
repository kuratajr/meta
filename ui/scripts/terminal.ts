// @ts-nocheck
let xterm = null;
let xtermFit = null;
let termWs = null;
let currentTerminalNode = '';
let currentTerminalUrl = '';

function updateUIStatus(newStatus) {
    const wrapper = document.getElementById('terminal-wrapper');
    const statusBadge = document.getElementById('status-badge');
    const statusText = document.getElementById('status-text');
    if (!wrapper || !statusBadge || !statusText) return;
    wrapper.className = 'terminal-outer-wrapper ' + newStatus;
    statusBadge.className = 'status-badge ' + newStatus;
    switch (newStatus) {
        case 'connecting': statusText.innerText = 'Đang kết nối...'; break;
        case 'online': statusText.innerText = 'Trực tuyến'; break;
        case 'offline': statusText.innerText = 'Đã ngắt kết nối'; break;
        case 'error': statusText.innerText = 'Lỗi kết nối'; break;
    }
}

function openTerminal(h, hostUrl) {
    currentTerminalNode = h;
    currentTerminalUrl = hostUrl;
    showSection('terminal');
    const terminalTitle = document.getElementById('terminal-section-title');
    terminalTitle.innerText = h;
    const originUrl = hostUrl.startsWith('http') ? hostUrl : "https://8877-" + hostUrl;
    const newTabBtn = document.getElementById('terminal-new-tab-btn');
    if (newTabBtn) newTabBtn.dataset.url = originUrl;
    updateUIStatus('connecting');
    initXterm(h);
}

function initXterm(h) {
    if (termWs) { try { termWs.close(); } catch (e) { } }
    termWs = null;
    const container = document.getElementById('xterm-container');
    container.innerHTML = '';
    xterm = new Terminal({
        cursorBlink: true, cursorStyle: 'bar', fontFamily: '"Ubuntu Mono", monospace', fontSize: 14, letterSpacing: 0.5,
        theme: {
            background: 'rgba(0, 0, 0, 0)', foreground: '#e6edf3', cursor: '#58a6ff', selection: 'rgba(88, 166, 255, 0.3)',
            black: '#484f58', red: '#ff7b72', green: '#3fb950', yellow: '#d29922', blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#b1bac4',
            brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364', brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff', brightCyan: '#56d4dd', brightWhite: '#ffffff',
        },
        allowTransparency: true, cols: 100, rows: 30
    });
    xtermFit = new FitAddon.FitAddon();
    xterm.loadAddon(xtermFit);
    xterm.open(container);
    setTimeout(() => { try { xtermFit.fit(); connectWs(h); } catch (e) { connectWs(h); } }, 150);
}

function connectWs(h) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + "//" + location.host + "/terminal-proxy/" + TOKEN + "/" + h + "/ws";
    termWs = new WebSocket(wsUrl, 'tty');
    termWs.binaryType = 'arraybuffer';
    const decoder = new TextDecoder();
    termWs.onopen = () => {
        updateUIStatus('online');
        xterm.write('\\x1b[38;5;82m[Hệ thống] Kết nối thành công! Đang đồng bộ hóa...\\x1b[0m\\r\\n');
        termWs.send(JSON.stringify({ "AuthToken": "", "columns": xterm.cols || 100, "rows": xterm.rows || 30 }));
    };
    termWs.onmessage = (ev) => {
        const processString = (msg) => { if (msg.startsWith('0')) xterm.write(msg.slice(1)); else if (!/^[12]/.test(msg)) xterm.write(msg); };
        if (ev.data instanceof ArrayBuffer) processString(decoder.decode(new Uint8Array(ev.data)));
        else if (typeof ev.data === 'string') processString(ev.data);
        else if (ev.data instanceof Blob) ev.data.text().then(processString);
    };
    termWs.onclose = () => { updateUIStatus('offline'); xterm.write('\\r\\n\\x1b[31m[Hệ thống] Kết nối đã đóng.\\x1b[0m\\r\\n'); };
    termWs.onerror = (err) => { updateUIStatus('error'); xterm.write('\\r\\n\\x1b[31m[Lỗi] Không thể kết nối tới server.\\x1b[0m\\r\\n'); };
    xterm.onData(data => { if (termWs && termWs.readyState === WebSocket.OPEN) termWs.send('0' + data); });
    xterm.onResize(size => { if (termWs && termWs.readyState === WebSocket.OPEN) termWs.send(JSON.stringify({ columns: size.cols, rows: size.rows })); });
    window.addEventListener('resize', () => xtermFit.fit());
}

function resetTerminal() { if (currentTerminalNode) initXterm(currentTerminalNode); }
