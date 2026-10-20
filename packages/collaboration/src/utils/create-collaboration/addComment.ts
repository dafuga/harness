import { z } from 'zod';
import type {
	Actor,
	AddCommentInput,
	CollaborationDependencies,
	Thread
} from '../../models/Collaboration.types';
import { actorSchema, anchorSchema, fail, id, parse } from '../parseCollaborationInput';
import { currentProject, now, transaction } from '../currentProject';

export async function addComment(
	deps: CollaborationDependencies,
	actor: Actor,
	input: AddCommentInput
) {
	const verified = parse(actorSchema, actor);
	const value = parse(
		z.strictObject({
			projectId: id,
			requestId: id,
			threadId: id.optional(),
			anchor: anchorSchema,
			text: z.string().trim().min(1).max(20000)
		}),
		input
	);
	const comment = {
		id: crypto.randomUUID(),
		requestId: value.requestId,
		actor: verified,
		text: value.text,
		createdAt: now(deps).toISOString()
	};
	const threadId = value.threadId ?? crypto.randomUUID();
	const result = await transaction(deps, async (records) => {
		const project = currentProject(records, verified, value.projectId, [
			'owner',
			'writer',
			'commenter'
		]);
		await deps.source.validateAnchor(project.sourceRepository, value.anchor);
		const prior = records.threads.find(
			(t) =>
				t.projectId === value.projectId && t.comments.some((c) => c.requestId === value.requestId)
		);
		if (prior) return replay(prior, verified, value);
		let thread = records.threads.find((t) => t.id === threadId && t.projectId === value.projectId);
		if (value.threadId && !thread) return fail('not-found');
		if (thread && JSON.stringify(thread.anchor) !== JSON.stringify(value.anchor))
			return fail('anchor-conflict');
		if (!thread) {
			thread = { id: threadId, projectId: value.projectId, anchor: value.anchor, comments: [] };
			records.threads.push(thread);
		}
		thread.comments.push(comment);
		return thread as Thread;
	});
	return { ...result.value, collaborationCommit: result.revision };
}

function replay(prior: Thread, actor: Actor, value: AddCommentInput): Thread {
	const message = prior.comments.find((c) => c.requestId === value.requestId)!;
	if (
		message.actor.id !== actor.id ||
		message.text !== value.text ||
		JSON.stringify(prior.anchor) !== JSON.stringify(value.anchor)
	)
		return fail('request-conflict');
	if (value.threadId && value.threadId !== prior.id) return fail('request-conflict');
	return prior;
}
