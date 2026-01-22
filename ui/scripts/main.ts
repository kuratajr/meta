// @ts-nocheck
if (typeof window !== 'undefined') {
    window.autoRefreshInterval = null;
    window.countdown = 30;
    window.isLive = false;

    window.toggleAutoRefresh = function () {
        window.isLive = !window.isLive;
        const btn = document.getElementById('btn-live');
        const dot = document.getElementById('live-dot');
        const txt = document.getElementById('live-text');
        if (window.isLive) {
            btn.innerText = "Disable Auto-Live";
            dot.classList.add('active');
            window.startAutoRefresh();
        } else {
            btn.innerText = "Enable Auto-Live";
            dot.classList.remove('active');
            window.stopAutoRefresh();
            txt.innerText = "Live: Off";
        }
    };

    window.startAutoRefresh = function () {
        window.stopAutoRefresh();
        window.countdown = 30;
        window.updateLiveText();
        window.autoRefreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                window.countdown--;
                if (window.countdown <= 0) {
                    window.refreshStatusDots();
                    window.countdown = 30;
                }
                window.updateLiveText();
            }
        }, 1000);
    };

    window.stopAutoRefresh = function () {
        if (window.autoRefreshInterval) clearInterval(window.autoRefreshInterval);
        window.autoRefreshInterval = null;
    };

    window.updateLiveText = function () {
        document.getElementById('live-text').innerText = "Live in " + window.countdown + "s";
    };

    // Initial load
    if (window.TOKEN) {
        window.showSection('nodes');
        window.refreshData();
    } else {
        const warning = document.getElementById('auth-warning');
        if (warning) warning.style.display = 'block';
    }
}
