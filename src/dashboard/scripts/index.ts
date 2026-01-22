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
