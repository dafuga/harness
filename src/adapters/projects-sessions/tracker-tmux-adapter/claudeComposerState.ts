// @harness-uid u_fyf7e7kyi5
import type { WatchdogPane } from '../../../services/projects-sessions/WatchdogPaneService.types';

const escape = '\u001b';
const styles = new RegExp(escape + '\\[[0-9;:]*m', 'g');
const faint = new RegExp('^\\s*' + escape + '\\[(?:2|2;[0-9;]+)m');
const rule = /^─{8}/u;

/**
 * @pure What Claude's input box holds: nothing (a faint suggestion counts as nothing), unsent text,
 * or null when no box is on screen above the cursor.
 */
export function claudeComposerState(pane: WatchdogPane): 'empty' | 'draft' | null {
	const lines = (pane.screen ?? '').split('\n');
	const plain = lines.map((line) => line.replace(styles, ''));
	const top = promptLine(plain, pane.y);
	if (top === null) return null;
	const text = (plain[top] ?? '').slice(1).trim();
	return !text || suggested(lines[top] ?? '') ? 'empty' : 'draft';
}

/** The line that opens the input box: a prompt under a rule, with no other rule down to the cursor. */
function promptLine(plain: readonly string[], cursor: number): number | null {
	for (let line = Math.min(cursor, plain.length - 1); line > 0; line--) {
		if (rule.test(plain[line] ?? '')) return null;
		if (/^❯/u.test(plain[line] ?? '') && rule.test(plain[line - 1] ?? '')) return line;
	}
	return null;
}

function suggested(styled: string) {
	return faint.test(styled.split('❯')[1]?.replace(escape + '[0m', '') ?? '');
}
