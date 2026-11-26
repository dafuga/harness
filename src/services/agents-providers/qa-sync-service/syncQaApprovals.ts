// @harness-uid u_nz4ky5f5hn
import type { QaSlackMessage, QaThreadState } from '../../../core/agents-providers/qaSync.types';
import { addQaLabel } from './addQaLabel';
import type { QaRun } from './qaRun.types';

/**
 * Applies each tester's check mark on the parent once. A label someone later removes stays
 * removed until the tester takes the check mark off and adds it again.
 */
export async function syncQaApprovals(
	run: QaRun,
	thread: QaThreadState,
	parent: QaSlackMessage
): Promise<void> {
	const marks = (parent.reactions ?? []).filter((reaction) =>
		run.config.approval.reactions.includes(reaction.name)
	);
	const marked = new Set(marks.flatMap((reaction) => reaction.users));
	const truncated = marks.some((reaction) => reaction.count > reaction.users.length);
	if (truncated) run.report.warnings.push(`#${thread.issue}: Slack truncated a reaction list.`);
	else thread.approved = thread.approved.filter((user) => marked.has(user));
	for (const { slackUser, name } of run.config.testers) {
		if (!marked.has(slackUser) || thread.approved.includes(slackUser)) continue;
		const label = run.config.approval.label.replace('{name}', name);
		await addQaLabel(run, { issue: thread.issue, label, reason: 'approval', by: slackUser });
		thread.approved.push(slackUser);
	}
}
