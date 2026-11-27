// @harness-uid u_mq2gkapunk
import type { QaSlackMessage, QaThreadState } from '../../../core/agents-providers/qaSync.types';
import { addQaLabel } from './addQaLabel';
import { detectRetest } from './detectRetest';
import { qaCommentNote } from './qaCommentNote';
import { routeQaItem } from './routeQaItem';
import type { QaRun } from './qaRun.types';

const humanSubtypes = new Set(['file_share', 'thread_broadcast']);

/** Handles replies past the cursor; the cursor moves only after every write succeeded. */
export async function syncQaReplies(
	run: QaRun,
	thread: QaThreadState,
	replies: readonly QaSlackMessage[]
): Promise<void> {
	const fresh = replies.filter(
		(reply) => reply.ts !== thread.parentTs && Number(reply.ts) > Number(thread.cursor)
	);
	for (const reply of fresh) await requestRetest(run, thread.issue, reply);
	await noteComments(run, thread, fresh.filter(isHumanComment));
	const newest = fresh.at(-1);
	if (newest) thread.cursor = newest.ts;
}

async function requestRetest(run: QaRun, issue: number, reply: QaSlackMessage): Promise<void> {
	const { retest, testers } = run.config;
	const allowed = [...retest.requesters, ...testers.map((tester) => tester.slackUser)];
	const by = [reply.user, reply.botId].find((id) => id && allowed.includes(id));
	if (!by) return;
	for (const environment of detectRetest(reply.text, retest)) {
		const label = retest.label.replace('{environment}', environment);
		await addQaLabel(run, { issue, label, reason: 'retest', by });
	}
}

async function noteComments(
	run: QaRun,
	thread: QaThreadState,
	comments: readonly QaSlackMessage[]
): Promise<void> {
	if (!comments.length) return;
	const { issue, channel, parentTs } = thread;
	const route = routeQaItem(await run.items(), issue, run.config.tracker.inboxItem);
	const { config, workspaceUrl } = run;
	const text = qaCommentNote({
		...{ config, workspaceUrl, channel, parentTs, issue, comments },
		routing: route.routing
	});
	if (!run.report.dryRun) await run.ports.tracker.note(route.item, text);
	run.report.actions.push({ kind: 'note', issue, item: route.item, text });
}

function isHumanComment(reply: QaSlackMessage): boolean {
	return !!reply.user && !reply.botId && (!reply.subtype || humanSubtypes.has(reply.subtype));
}
