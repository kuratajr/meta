// @ts-nocheck
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

if (TOKEN) {
    showSection('nodes');
    refreshData();
} else {
    document.getElementById('auth-warning').style.display = 'block';
}
