// @ts-nocheck
if (typeof window !== 'undefined') {
    window.toggleSidebar = function () {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('overlay').classList.toggle('show');
    };

    window.showSection = function (id) {
        if (window.innerWidth <= 1024) {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('overlay').classList.remove('show');
        }

        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        const target = document.getElementById('section-' + id);
        if (target) target.classList.add('active');

        document.getElementById('nav-' + id)?.classList.add('active');

        let sectionTitle = id.charAt(0).toUpperCase() + id.slice(1);
        if (id === 'ips') sectionTitle = 'IP Management';
        else if (id === 'cloud') sectionTitle = 'Cloud-init Meta';
        else if (id === 'global') sectionTitle = 'Global & Security';
        else if (id === 'logs') { sectionTitle = 'Logs & Activity'; window.refreshLogs(); }

        document.getElementById('page-title').innerText = sectionTitle;

        const nodesSearchBox = document.getElementById('nodes-search-box');
        if (nodesSearchBox) {
            nodesSearchBox.className = (['nodes', 'groups', 'configs', 'templates'].includes(id)) ? 'search-container show' : 'search-container';
        }
    };

    window.toggleDropdown = function (event) {
        event.stopPropagation();
        const content = event.currentTarget.nextElementSibling;
        const isShow = content.classList.contains('show');
        document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
        if (!isShow) content.classList.add('show');
    };

    window.onclick = function (event) {
        if (!event.target.matches('.dropdown-trigger') && !event.target.closest('.dropdown-trigger')) {
            document.querySelectorAll('.dropdown-content').forEach(d => d.classList.remove('show'));
        }
    };
}
