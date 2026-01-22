// @ts-ignore
import gRaw from './globals.ts';
// @ts-ignore
import uRaw from './ui.ts';
// @ts-ignore
import dRaw from './data.ts';
// @ts-ignore
import tRaw from './terminal.ts';
// @ts-ignore
import mRaw from './modals.ts';
// @ts-ignore
import lRaw from './logs.ts';
// @ts-ignore
import maRaw from './main.ts';

const extract = (r: any) => typeof r === 'string' ? r : (r.default || "");

const SCRIPTS_GLOBALS = extract(gRaw);
const SCRIPTS_UI = extract(uRaw);
const SCRIPTS_DATA = extract(dRaw);
const SCRIPTS_TERMINAL = extract(tRaw);
const SCRIPTS_MODALS = extract(mRaw);
const SCRIPTS_LOGS = extract(lRaw);
const SCRIPTS_MAIN = extract(maRaw);

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
