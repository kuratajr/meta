// @ts-ignore
import styles from './dashboard/styles.css';
// @ts-ignore
import scripts from './dashboard/scripts.js';
// @ts-ignore
import htmlTemplate from './dashboard/index.html';

export const DASHBOARD_HTML = htmlTemplate
    .replace('{{STYLES}}', styles)
    .replace('{{SCRIPTS}}', scripts);