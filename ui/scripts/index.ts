// @ts-ignore
import SCRIPTS_GLOBALS from './globals.ts';
// @ts-ignore
import SCRIPTS_UI from './ui.ts';
// @ts-ignore
import SCRIPTS_DATA from './data.ts';
// @ts-ignore
import SCRIPTS_TERMINAL from './terminal.ts';
// @ts-ignore
import SCRIPTS_MODALS from './modals.ts';
// @ts-ignore
import SCRIPTS_LOGS from './logs.ts';
// @ts-ignore
import SCRIPTS_MAIN from './main.ts';

/**
 * These are imported as raw strings via Wrangler's Text rules.
 * Because they are in the ui/ folder, they are NOT compiled as modules.
 */
export const SCRIPTS_COMBINED = `
    <script>
        ${SCRIPTS_GLOBALS}
        ${SCRIPTS_UI}
        ${SCRIPTS_DATA}
        ${SCRIPTS_TERMINAL}
        ${SCRIPTS_MODALS}
        ${SCRIPTS_LOGS}
        ${SCRIPTS_MAIN}
    </script>
`;
