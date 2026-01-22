import {
    GLOBALS_JS, UI_JS, DATA_JS, TERMINAL_JS,
    MODALS_JS, LOGS_JS, MAIN_JS
} from './assets';

/**
 * High-reliability Script Assembler.
 * Uses explicit TypeScript string constants to avoid Wrangler module conflicts.
 */
export const SCRIPTS_COMBINED = `
    <script>
        ${GLOBALS_JS}
        ${UI_JS}
        ${DATA_JS}
        ${TERMINAL_JS}
        ${MODALS_JS}
        ${LOGS_JS}
        ${MAIN_JS}
    </script>
`;
