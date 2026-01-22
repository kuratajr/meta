// @ts-ignore
import DASHBOARD_STYLES from './styles.css';
// @ts-ignore
import DASHBOARD_BODY from './body.html';
import { SCRIPTS_COMBINED } from './scripts/index';

export const DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VPS Cloud Control Center</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&family=Ubuntu+Mono&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
    <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js"></script>
    <style>
        ${DASHBOARD_STYLES}
    </style>
</head>
<body>
    ${DASHBOARD_BODY}
    ${SCRIPTS_COMBINED}
</body>
</html>
`;
