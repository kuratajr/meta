// @ts-nocheck
const TOKEN = new URLSearchParams(window.location.search).get('token');
let currentKey = '';
let isNew = false;
let groupsData = [];
let lastData = null;
let currentSearch = '';
let previousStatuses = {};
let currentStatusFilter = 'all';

// Log states for pagination
let logState = {
    system: { offset: 0, date: new Date().toLocaleDateString('en-CA'), hostname: '', loading: false, hasMore: true, lastDateStr: '' },
    live: { offset: 0, date: '', hostname: '', loading: false, hasMore: true, lastDateStr: '' }
};
