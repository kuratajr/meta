// @ts-nocheck
if (typeof window !== 'undefined') {
    window.xterm = null;
    window.xtermFit = null;
    window.termWs = null;
    window.currentTerminalNode = '';
    window.currentTerminalUrl = '';

    window.updateUIStatus = function (newStatus) {
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
    };

    window.openTerminal = function (h, hostUrl) {
        window.currentTerminalNode = h;
        window.currentTerminalUrl = hostUrl;
        window.showSection('terminal');
        const terminalTitle = document.getElementById('terminal-section-title');
        terminalTitle.innerText = h;
        const originUrl = hostUrl.startsWith('http') ? hostUrl : "https://8877-" + hostUrl;
        const newTabBtn = document.getElementById('terminal-new-tab-btn');
        if (newTabBtn) newTabBtn.dataset.url = originUrl;
        window.updateUIStatus('connecting');
        window.initXterm(h);
    };

    window.initXterm = function (h) {
        if (window.termWs) { try { window.termWs.close(); } catch (e) { } }
        window.termWs = null;
        const container = document.getElementById('xterm-container');
        container.innerHTML = '';
        window.xterm = new Terminal({
            cursorBlink: true, cursorStyle: 'bar', fontFamily: '"Ubuntu Mono", monospace', fontSize: 14, letterSpacing: 0.5,
            theme: {
                background: 'rgba(0, 0, 0, 0)', foreground: '#e6edf3', cursor: '#58a6ff', selection: 'rgba(88, 166, 255, 0.3)',
                black: '#484f58', red: '#ff7b72', green: '#3fb950', yellow: '#d29922', blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#b1bac4',
                brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364', brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff', brightCyan: '#56d4dd', brightWhite: '#ffffff',
            },
            allowTransparency: true, cols: 100, rows: 30
        });
        window.xtermFit = new FitAddon.FitAddon();
        window.xterm.loadAddon(window.xtermFit);
        window.xterm.open(container);
        setTimeout(() => { try { window.xtermFit.fit(); window.connectWs(h); } catch (e) { window.connectWs(h); } }, 150);
    };

    window.connectWs = function (h) {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = protocol + "//" + location.host + "/terminal-proxy/" + window.TOKEN + "/" + h + "/ws";
        window.termWs = new WebSocket(wsUrl, 'tty');
        window.termWs.binaryType = 'arraybuffer';
        const decoder = new TextDecoder();
        window.termWs.onopen = () => {
            window.updateUIStatus('online');
            window.xterm.write('\\x1b[38;5;82m[Hệ thống] Kết nối thành công! Đang đồng bộ hóa...\\x1b[0m\\r\\n');
            window.termWs.send(JSON.stringify({ "AuthToken": "", "columns": window.xterm.cols || 100, "rows": window.xterm.rows || 30 }));
        };
        window.termWs.onmessage = (ev) => {
            const processString = (msg) => { if (msg.startsWith('0')) window.xterm.write(msg.slice(1)); else if (!/^[12]/.test(msg)) window.xterm.write(msg); };
            if (ev.data instanceof ArrayBuffer) processString(decoder.decode(new Uint8Array(ev.data)));
            else if (typeof ev.data === 'string') processString(ev.data);
            else if (ev.data instanceof Blob) ev.data.text().then(processString);
        };
        window.termWs.onclose = () => { window.updateUIStatus('offline'); window.xterm.write('\\r\\n\\x1b[31m[Hệ thống] Kết nối đã đóng.\\x1b[0m\\r\\n'); };
        window.termWs.onerror = (err) => { window.updateUIStatus('error'); window.xterm.write('\\r\\n\\x1b[31m[Lỗi] Không thể kết nối tới server.\\x1b[0m\\r\\n'); };
        window.xterm.onData(data => { if (window.termWs && window.termWs.readyState === WebSocket.OPEN) window.termWs.send('0' + data); });
        window.xterm.onResize(size => { if (window.termWs && window.termWs.readyState === WebSocket.OPEN) window.termWs.send(JSON.stringify({ columns: size.cols, rows: size.rows })); });
        window.addEventListener('resize', () => window.xtermFit.fit());
    };

    window.resetTerminal = function () { if (window.currentTerminalNode) window.initXterm(window.currentTerminalNode); };
}
