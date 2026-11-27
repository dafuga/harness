// @harness-uid u_k2msamt5dy
/**
 * Page expressions against Hub Home's "Blocked - needs you" rows. A row is found by the list and
 * its question, so a row without buttons is still found and reported as having none.
 */
const rowWith = (marker: string) =>
	`[...document.querySelectorAll('.hh-needs-list > *')].find((row) => row.querySelector('.hh-needs-question')?.textContent.includes(${JSON.stringify(marker)}))`;
const choices = "[...row.querySelectorAll('.hh-choices .hh-choice')]";
const labelOf = "choice.querySelector('strong')?.textContent.trim()";

/** The option labels on the row, or null while there is no such row. */
export function rowLabelsScript(marker: string): string {
	return `(() => { const row = ${rowWith(marker)}; return row ? ${choices}.map((choice) => ${labelOf}) : null; })()`;
}

/** Press one option on the row. False when it is missing or disabled. */
export function pressOptionScript(marker: string, label: string): string {
	return `(() => { const row = ${rowWith(marker)}; if (!row) return false; const button = ${choices}.find((choice) => ${labelOf} === ${JSON.stringify(label)}); if (!button || button.disabled) return false; button.click(); return true; })()`;
}

/** One yes or no. The account itself never leaves the page. */
export const signedInScript = `fetch('/api/auth/status', { cache: 'no-store' }).then((reply) => reply.json()).then((status) => Boolean(status.actor))`;
