// @ts-ignore
import styles from './dashboard/styles.css';
// @ts-ignore
import scripts from './dashboard/scripts.js';
// @ts-ignore
import htmlTemplate from './dashboard/dashboard.html';

export const DASHBOARD_HTML = htmlTemplate
    .replace('__STYLES_CONTENT__', styles)
    .replace('__SCRIPTS_CONTENT__', scripts);