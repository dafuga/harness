// @harness-uid u_fyf7e7kyi5
import { setTimeout as delay } from 'node:timers/promises';
import { trackerPaneFormat, trackerTmuxKeys, trackerTmuxText } from './trackerTmuxPane';
import { submitClaudeDraft } from './claudeTmuxSubmission';
import type { TrackerTmuxNudge, TrackerTmuxPane } from '../TrackerTmuxAdapter.types';

const escape = '\u001b';
const control = new RegExp(escape + '\\[[0-9;:]*m', 'g');
const codexWorking = /^\s*(?:[•◦·]\s*)?(?:Working|Thinking)\b.*\besc to interrupt\b/imu;
const claudeWorking = /^\s*[^\w\s]+\s*[^\n]*(?:esc to interrupt|ctrl\+c to interrupt)\b/imu;

async function verifyTrackerTmuxSubmission(
	input: TrackerTmuxNudge,
	effects: {
		capture: () => Promise<TrackerTmuxPane | undefined>;
		submit: (draft: TrackerTmuxPane) => Promise<boolean>;
	},
	signal: AbortSignal
): Promise<boolean> {
	let submitted = false;
	for (let attempt = 0; attempt < 8; attempt++) {
		await delay(attempt === 0 ? 180 : 250, undefined, { signal });
		const current = await effects.capture();
		if (!current) return false;
		const text = current.pane.screen?.replace(control, '');
		if (!text) continue;
		if (isWorking(current.pane.y, text, input.cli)) return true;
		if (submitted || !needsSecondEnter(current, text, input, attempt)) continue;
		submitted = await effects.submit(current);
		if (!submitted) return false;
	}
	return false;
}

function needsSecondEnter(
	current: TrackerTmuxPane,
	text: string,
	input: TrackerTmuxNudge,
	attempt: number
) {
	return attempt > 0 && input.cli === 'codex' && hasDraft(current, text, input.message);
}

function isWorking(cursor: number, text: string, cli: TrackerTmuxNudge['cli']): boolean {
	// The live activity line is near the composer. Scrollback can contain old copies.
	const lines = text.trimEnd().split('\n');
	const nearby = lines.slice(Math.max(0, cursor - 7), Math.max(cursor + 6, lines.length - 2));
	return (cli === 'codex' ? codexWorking : claudeWorking).test(nearby.join('\n'));
}

function hasDraft({ pane }: TrackerTmuxPane, text: string, message: string): boolean {
	const lines = text.split('\n').slice(0, pane.y + 1);
	const fromCursor = lines.slice(-12).reverse();
	const last = fromCursor.findIndex((line) => /^›\s/u.test(line));
	if (last === -1) return false;
	const draft = fromCursor
		.slice(0, last + 1)
		.reverse()
		.join('')
		.replace(/^›\s*/u, '');
	return draft.replace(/\s+/gu, '') === message.replace(/\s+/gu, '');
}

export async function sendTrackerTmuxNudge(
	input: TrackerTmuxNudge,
	{ id, raw }: TrackerTmuxPane,
	effects: {
		command: (args: string[]) => Promise<{ code: number; stdout: string }>;
		capture: () => Promise<TrackerTmuxPane | undefined>;
	},
	signal: AbortSignal
) {
	const send = async (layout: string, keys: string) => {
		const result = await effects.command([
			'if-shell',
			'-F',
			'-t',
			id,
			`#{==:${trackerPaneFormat},${layout}}`,
			keys
		]);
		return result.code === 0 && result.stdout.trim() === 'tracker-watchdog-sent';
	};
	const enter = (draft: TrackerTmuxPane) => send(draft.raw, trackerTmuxKeys(id));
	if (input.cli === 'claude') {
		if (!(await send(raw, trackerTmuxText(id, input.message)))) return false;
		const working = ({ y, screen }: TrackerTmuxPane['pane']) =>
			isWorking(y, (screen ?? '').replace(control, ''), 'claude');
		return submitClaudeDraft({ capture: effects.capture, enter, working }, signal);
	}
	if (!(await send(raw, trackerTmuxKeys(id, input.message)))) return false;
	return verifyTrackerTmuxSubmission(input, { capture: effects.capture, submit: enter }, signal);
}

export async function trackerTmuxCwd(
	id: string,
	command: (args: string[]) => Promise<{ code: number; stdout: string }>
) {
	const result = await command(['display-message', '-p', '-t', id, '#{pane_current_path}']);
	const path = result.stdout.trimEnd();
	return result.code === 0 && /^\/[^\p{Cc}]{0,4095}$/u.test(path) ? path : undefined;
}
