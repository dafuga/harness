// @harness-uid u_fyf7e7kyi5
import { setTimeout as delay } from 'node:timers/promises';
import { claudeComposerState } from './claudeComposerState';
import type {
	ClaudeSubmissionEffects,
	ClaudeSubmissionProgress
} from './claudeTmuxSubmission.types';
import type { TrackerTmuxPane } from '../TrackerTmuxAdapter.types';

const polls = 20;
const pollGap = 250;
/** Press Enter without having recognised the draft once it has had this many polls to appear. */
const draftWait = 6;
const enterGap = 4;
const maxEnters = 3;

/**
 * Claude Code takes text and an Enter that arrive together as one paste, so the Enter must be a
 * later key press. The receipt is Claude working, or the draft this session saw leaving the box.
 */
export async function submitClaudeDraft(
	effects: ClaudeSubmissionEffects,
	signal: AbortSignal
): Promise<boolean> {
	const progress = { enters: 0, lastEnter: 0, sawDraft: false };
	for (let poll = 0; poll < polls; poll++) {
		await delay(pollGap, undefined, { signal });
		const current = await effects.capture();
		if (!current) return false;
		if (!current.pane.screen) continue;
		if (await advance(effects, current, { progress, poll })) return true;
	}
	return false;
}

/** True once there is proof of submission; otherwise press Enter when it is due. */
async function advance(
	effects: ClaudeSubmissionEffects,
	current: TrackerTmuxPane,
	{ progress, poll }: { progress: ClaudeSubmissionProgress; poll: number }
) {
	const composer = claudeComposerState(current.pane);
	if (submitted(progress, composer, effects.working(current.pane))) return true;
	progress.sawDraft ||= composer === 'draft';
	if (!enterDue(progress, composer, poll) || !(await effects.enter(current))) return false;
	progress.enters += 1;
	progress.lastEnter = poll;
	return false;
}

function submitted(
	{ enters, sawDraft }: ClaudeSubmissionProgress,
	composer: ReturnType<typeof claudeComposerState>,
	working: boolean
) {
	return enters > 0 && (working || (sawDraft && composer === 'empty'));
}

function enterDue(
	{ enters, lastEnter }: ClaudeSubmissionProgress,
	composer: ReturnType<typeof claudeComposerState>,
	poll: number
) {
	if (!enters) return composer === 'draft' || poll >= draftWait;
	return composer === 'draft' && enters < maxEnters && poll - lastEnter >= enterGap;
}
