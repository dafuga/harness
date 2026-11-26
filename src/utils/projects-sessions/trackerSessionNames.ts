// @harness-uid u_a4rjzqhwpz
import type { TrackerNamedItem, TrackerTmuxWindow } from './trackerSessionNames.types';

/** Panes the launcher owns. Their evidence comes from run receipts, not from their names. */
const managedSession = /^auto-[a-z0-9]{6,10}-r[0-9]+$/;
/** Shell, process and Chief of Staff names that say nothing about which item a pane serves. */
const genericNames = new Set([
	'',
	'zsh',
	'bash',
	'sh',
	'fish',
	'node',
	'tmux',
	'claude',
	'codex',
	'cos'
]);

/**
 * "Project: title", used for the tmux window, Claude Remote Control and `runs.session_name`.
 * tmux expands `#` sequences in window names, including `#(command)`, so they are removed.
 */
export function trackerSessionLabel(item: TrackerNamedItem, fallback = 'Tracker'): string {
	const { title, project, agent } = item;
	const name = [project, agent].find(Boolean) ?? fallback;
	return `${name.charAt(0).toUpperCase()}${name.slice(1)}: ${title ?? ''}`
		.replace(/#[({[]?/g, '')
		.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
		.slice(0, 80);
}

/** The names a hand-launched session or window for this item may carry, ready to compare. */
export function trackerSessionNames(item: TrackerNamedItem): ReadonlySet<string> {
	const label = trackerSessionLabel(item, '');
	return new Set(
		[item.id, item.id.slice(0, 6), item.owner ?? '', label]
			.map(comparable)
			.filter((name) => !genericNames.has(name))
	);
}

/** Whether a hand-launched tmux session or window is named for this item. */
export function trackerHandSession(
	windows: readonly TrackerTmuxWindow[],
	item: TrackerNamedItem
): boolean {
	const wanted = trackerSessionNames(item);
	return windows.some(
		({ session, window }) =>
			!managedSession.test(session) &&
			[session, window].some((name) => wanted.has(comparable(name)))
	);
}

function comparable(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, ' ');
}
