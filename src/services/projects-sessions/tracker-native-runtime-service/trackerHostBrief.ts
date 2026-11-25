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
		'',
		...trackerPlanningLines(item, id),
		'Keep working through verification. Pause only when the task is done or a true blocker prevents further work.',
		'At 150,000 active context tokens, leave a short Tracker handoff with the exact worktree, branch, completed work, pending checks and next step.',
		'',
		completion
	]
		.filter((line) => line !== null && line !== undefined && line !== false)
		.join('\n');
}

function trackerPlanningLines(item: TrackerItem, id: string): string[] {
	return [
		'## Planning stages',
		'',
		`Current planning stage: ${item.stage ?? 'idea'}`,
		'',
		`For a new user-facing feature or a feature without a UI, read the saved artifacts with \`tracker show ${id} --json\` and resume at the current stage. Follow these steps in order, honoring the item's scope and review or approval requirements. If there are no pages, document the intended behavior and applicable states.`,
		`1. Idea: write a one-paragraph idea and save it with \`tracker artifact ${id} idea <file>\`. Then run \`tracker stage ${id} detail\`.`,
		`2. Detailed idea: describe the feature and save main-page designs (at least two main pages when the feature has that many) with \`tracker artifact ${id} detail <file>\`. Then run \`tracker stage ${id} design\`.`,
		`3. Full design: design every page and its applicable states, including empty, loading, error and filled. Save each page, state description and design link with \`tracker artifact ${id} design <file>\`. After the required review, run \`tracker stage ${id} build\`.`,
		`4. Implementation: implement only at build. Save PR and verification evidence with \`tracker artifact ${id} build <file>\` before closing the item.`,
		''
	];
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
