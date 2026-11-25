// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';

import { trackerAskOptionsRule } from './trackerAskOptionsRule';
import { trackerSecretSafetyRule } from './trackerSecretSafetyRule';

export function formatTrackerHostBrief(
	item: TrackerItem,
	completion: string,
	recovery = false
): string {
	const id = item.id.slice(0, 6);
	const notes = item.notes_log.slice(-10).map(({ at, text }) => `- ${at} ${text.slice(0, 1200)}`);
	return [
		trackerSecretSafetyRule,
		'',
		trackerAskOptionsRule,
		'',
		'## Video evidence',
		'',
		'If the task asks for a video, deliver a screen recording of the real app.',
		'Extract frames that show the requested app flow and inspect them.',
		'In the acceptance evidence, list the timestamp of each extracted frame and describe what it shows.',
		'ffprobe output alone is insufficient.',
		'',
		`# ${item.title}`,
		'',
		`Tracker item ${id} (full ID ${item.id}).`,
		'',
		item.sensitive &&
			'Keep credentials out of output and obtain approval before any irreversible action.',
		item.adapter_instructions && `## Source instructions\n\n${item.adapter_instructions}`,
		item.notes && `## Task\n\n${item.notes.slice(0, 32000)}`,
		notes.length > 0 && `## Recent notes\n\n${notes.join('\n')}`,
		...trackerResumeLines(item, recovery),
		`Start by running \`tracker start ${id}\`.`,
		'Keep working through verification. Pause only when the task is done or a true blocker prevents further work.',
		'At 150,000 active context tokens, leave a short Tracker handoff with the exact worktree, branch, completed work, pending checks and next step.',
		'',
		completion
	]
		.filter((line) => line !== null && line !== undefined && line !== false)
		.join('\n');
}
function trackerResumeLines(item: TrackerItem, recovery: boolean) {
	if (!recovery) return [];
	const handoff = item.notes_log
		.filter(({ text }) => /^stopped:.*?\bresume from\s*:/is.test(text))
		.at(-1);
	return [
		handoff && `## Last handoff\n\n${handoff.text.slice(0, 4000)}`,
		item.needs_daniel &&
			!item.resolved &&
			'An unanswered Tracker question remains open. Continue independent work and preserve any approval gates.'
	];
}
