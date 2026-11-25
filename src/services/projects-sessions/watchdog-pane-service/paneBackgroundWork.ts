// @harness-uid u_dakcgp2ade
import type { WatchdogPane } from '../WatchdogPaneService.types';

const escape = '\u001b';
const controls = new RegExp(escape + '\\[[0-9;:]*m', 'g');
const claudeBackground = /^\s*[⏵⏸].*·\s*\d+\s+(?:shells?|monitors?|background tasks?)\b/u;
const codexBackground = /^\s*\d+ background terminals? running\b/;

/** The provider's own report of a background shell, monitor or terminal that is still alive. */
export function paneBackgroundWork(pane: WatchdogPane): boolean {
	const lines = (pane.screen ?? '').replace(controls, '').split('\n');
	// Claude reports under its composer and Codex just above it. Transcript text is ignored.
	return (
		lines.slice(pane.y + 2).some((line) => claudeBackground.test(line)) ||
		lines.slice(Math.max(0, pane.y - 5), pane.y).some((line) => codexBackground.test(line))
	);
}
