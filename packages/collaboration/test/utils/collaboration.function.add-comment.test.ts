import { test } from 'vitest';
import type {
	Actor,
	AddCommentInput
} from '../../src/models/planning-collaboration/Collaboration.types';
import {
	anchorAt,
	call,
	commit,
	commenter,
	draft,
	entityId,
	owner,
	recordsBranch,
	revised,
	revisionOf,
	unknownThread,
	unreachable,
	viewer,
	writer
} from './collaboration.function.add-comment.fixtures';
import type { Outcome } from './collaboration.function.add-comment.test.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** One recorded case: who was given the input, the input itself, and what came back. */
const caseOf = (name: string, who: Actor, input: AddCommentInput, outcome: Outcome) => ({
	name,
	input: { actor: who.id, ...input },
	...outcome
});
/** The evidence of one state: its cases, under the unit and the function they show. */
const where = (state: string) => ({
	unitId: 'collaboration.function.add-comment',
	symbol: 'addComment',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

test('addComment starts a thread at a source anchor, appends a reply to it and refuses a reply at another commit', async () => {
	const store = recordsBranch();
	const opening = draft(1, '  Tighten the capability note.  ');
	const opened = await call(store.deps, owner, opening);
	const threadId = opened.output?.threadId;
	const reply = draft(2, 'Agreed, I will check the capability gate.', { threadId });
	const replied = await call(store.deps, writer, reply);
	const elsewhere = draft(3, 'The same question at the newer commit.', {
		threadId,
		anchor: anchorAt(revised)
	});
	const refused = await call(store.deps, commenter, elsewhere);
	recordExampleCases(where('add-comment-thread'), [
		caseOf('owner starts a thread with trimmed text', owner, opening, opened),
		caseOf('writer replies to the thread at the same anchor', writer, reply, replied),
		caseOf('commenter replies at another commit of the entity', commenter, elsewhere, refused)
	]);
	expect(opened.output).toMatchObject({
		anchor: { entityId, commit },
		comments: [{ actorId: owner.id, text: 'Tighten the capability note.' }],
		collaborationCommit: revisionOf(2)
	});
	expect(replied.output).toMatchObject({
		threadId,
		comments: [{ actorId: owner.id }, { actorId: writer.id }],
		collaborationCommit: revisionOf(3)
	});
	expect(refused.error).toEqual({
		code: 'anchor-conflict',
		message: 'Collaboration anchor-conflict'
	});
	expect(store.revision()).toBe(revisionOf(3));
});

test('addComment called again with the same request ID returns the existing thread and refuses that request ID with other text', async () => {
	const store = recordsBranch();
	const input = draft(4, 'Keep the capability check before the thread lookup.');
	const changed = draft(4, 'Keep the capability check after the thread lookup.');
	const first = await call(store.deps, commenter, input);
	const again = await call(store.deps, commenter, input);
	const edited = await call(store.deps, commenter, changed);
	recordExampleCases(where('add-comment-repeat-request'), [
		caseOf('commenter posts a request for the first time', commenter, input, first),
		caseOf('the identical request is posted again', commenter, input, again),
		caseOf('the same request ID comes with other text', commenter, changed, edited)
	]);
	expect(first.output?.comments).toHaveLength(1);
	expect(again.output).toEqual(first.output);
	expect(edited.error).toEqual({
		code: 'request-conflict',
		message: 'Collaboration request-conflict'
	});
	expect(store.threads()).toHaveLength(1);
	expect(store.revision()).toBe(revisionOf(2));
});

test('addComment refuses a viewer, blank text, an unknown thread and an anchor the branch does not reach, and writes nothing', async () => {
	const store = recordsBranch();
	const byViewer = draft(5, 'Looks good to me.');
	const blank = draft(6, '   ');
	const missing = draft(7, 'Replying to a thread that was removed.', { threadId: unknownThread });
	const unreached = draft(8, 'Commenting on an abandoned branch.', {
		anchor: anchorAt(unreachable)
	});
	const refusedViewer = await call(store.deps, viewer, byViewer);
	const refusedBlank = await call(store.deps, commenter, blank);
	const refusedMissing = await call(store.deps, commenter, missing);
	const refusedUnreached = await call(store.deps, commenter, unreached);
	recordExampleCases(where('add-comment-refused-writes'), [
		caseOf('a viewer is refused as forbidden', viewer, byViewer, refusedViewer),
		caseOf('blank text is refused as invalid input', commenter, blank, refusedBlank),
		caseOf('a reply to an unknown thread is not found', commenter, missing, refusedMissing),
		caseOf('an anchor off the branch is refused', commenter, unreached, refusedUnreached)
	]);
	const codes = [refusedViewer, refusedBlank, refusedMissing, refusedUnreached].map(
		(outcome) => outcome.error?.code
	);
	expect(codes).toEqual(['forbidden', 'invalid-input', 'not-found', 'unreachable-anchor']);
	expect(store.threads()).toEqual([]);
	expect(store.revision()).toBe(revisionOf(1));
});
