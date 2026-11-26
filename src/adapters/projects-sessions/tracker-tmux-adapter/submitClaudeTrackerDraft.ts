// @harness-uid u_fyf7e7kyi5
import { setTimeout as delay } from 'node:timers/promises';
import type { TrackerTmuxPane } from '../TrackerTmuxAdapter.types';

const escape = '\u001b';
const control = new RegExp(escape + '\\[[0-9;:]*m', 'g');
const rule = /^─{8}/u;
/** How Claude Code shows a long paste in its composer; a very long one shows as several. */
const pasteMark = /\[Pastedtext#\d+(?:\+\d+lines)?\]/u;
const pollMs = 250;
const resendAfterMs = 5_000;
/** Stays inside the shortest delivery deadline, 15 seconds. */
const limitMs = 12_000;
const enterLimit = 2;

type ClaudeComposer = 'empty' | 'ours' | 'other' | 'unknown';

/**
 * Submit a message already typed into an empty Claude composer. Claude reads text and an Enter that
 * arrive together as one paste, so Enter goes separately, only once the box shows this message, and
 * again if it is still there after five seconds. Any other text in the box is never submitted.
 */
export async function submitClaudeTrackerDraft(
	message: string,
	effects: {
		capture: () => Promise<TrackerTmuxPane | undefined>;
		submit: (draft: TrackerTmuxPane) => Promise<boolean>;
		working: (pane: TrackerTmuxPane['pane']) => boolean;
	},
	signal: AbortSignal
): Promise<boolean> {
	const end = Date.now() + limitMs;
	let enters = 0;
	let enteredAt = 0;
	while (Date.now() < end) {
		await delay(pollMs, undefined, { signal });
		const current = await effects.capture();
		if (!current) return false;
		const composer = claudeComposer(current.pane, message);
		if (enters && accepted(composer, () => effects.working(current.pane))) return true;
		if (composer !== 'ours' || !enterDue(enters, enteredAt)) continue;
		// A pane that changed since this capture refuses the key; the next poll looks again.
		if (!(await effects.submit(current))) continue;
		enters++;
		enteredAt = Date.now();
	}
	return false;
}

/** After an Enter, the message is in once the box is empty or Claude works without it. */
function accepted(composer: ClaudeComposer, working: () => boolean): boolean {
	return composer === 'empty' || (composer !== 'ours' && working());
}

function enterDue(enters: number, enteredAt: number): boolean {
	return enters === 0 || (enters < enterLimit && Date.now() - enteredAt >= resendAfterMs);
}

/** Find the lines between the two rules around the cursor. */
function composerBox(lines: readonly string[], y: number) {
	let top = Math.min(y, lines.length - 1);
	while (top > 0 && !(lines[top].startsWith('❯') && rule.test(lines[top - 1]))) top--;
	const bottom = lines.findIndex((line, index) => index > top && rule.test(line));
	return top > 0 && bottom > y ? { top, bottom } : null;
}

function claudeComposer(
	{ screen, x, y }: TrackerTmuxPane['pane'],
	message: string
): ClaudeComposer {
	const lines = screen?.replace(control, '').split('\n') ?? [];
	const box = composerBox(lines, y);
	if (!box) return 'unknown';
	const { top, bottom } = box;
	// An empty box keeps the cursor at its start, even while it shows a suggestion.
	if (x === 2 && y === top && bottom === top + 1) return 'empty';
	const draft = unspaced(lines.slice(top, bottom).join('').slice(1));
	return holdsOnly(draft, unspaced(message)) ? 'ours' : 'other';
}

/** The box shows the whole message, or pastes with any typed remainder taken from it in order. */
function holdsOnly(draft: string, message: string): boolean {
	const typed = draft.split(pasteMark);
	if (typed.length === 1) return draft === message;
	let from = 0;
	return typed.every((part) => {
		const at = message.indexOf(part, from);
		from = at + part.length;
		return at !== -1;
	});
}

function unspaced(text: string): string {
	return text.replace(/\s+/gu, '');
}
