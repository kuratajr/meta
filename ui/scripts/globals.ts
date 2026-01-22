// @ts-nocheck
if (typeof window !== 'undefined') {
    window.TOKEN = new URLSearchParams(window.location.search).get('token');
    window.currentKey = '';
    window.isNew = false;
    window.groupsData = [];
    window.lastData = null;
    window.currentSearch = '';
    window.previousStatuses = {};
    window.currentStatusFilter = 'all';

    // Log states for pagination
    window.logState = {
        system: { offset: 0, date: new Date().toLocaleDateString('en-CA'), hostname: '', loading: false, hasMore: true, lastDateStr: '' },
        live: { offset: 0, date: '', hostname: '', loading: false, hasMore: true, lastDateStr: '' }
    };
}
