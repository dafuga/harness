import { test } from 'vitest';
import { addComment } from '../../src/utils/addComment';
import type {
	Actor,
	AddCommentInput,
	Anchor,
	CollaborationDependencies,
	CollaborationRecords,
	CollaborationRepository,
	CommittedThread,
	SourceAdapter
} from '../../src/models/Collaboration.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real addComment, called as its callers call it, against an in-memory records branch. Each
 * state is one test; what it was given and what came back are recorded as that state's cases.
 */
const person = (id: string, name: string): Actor => ({
	id: `google:${id}`,
	email: `${id}@example.test`,
	name,
	emailVerified: true
});
const owner = person('owner', 'Owner');
const writer = person('writer', 'Writer');
const commenter = person('commenter', 'Commenter');
const viewer = person('viewer', 'Viewer');
const projectId = '6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const entityId = 'desktop.function.compose-modes';
const sourceRepository = {
	id: 202,
	owner: 'acme',
	name: 'pilot',
	private: true,
	installationId: 7
};
/** Two commits the branch reaches, and one it does not. */
const commit = '9f2c4e1a'.repeat(5);
const revised = '4b7d1e9c'.repeat(5);
const unreachable = 'deadbeef'.repeat(5);
/** A numbered request ID: a valid UUID that is the same on every run. */
const request = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const unknownThread = request(99);
/** A committed revision is named by its count, as a commit is named by its hash. */
const revisionOf = (count: number) => count.toString(16).padStart(40, '0');
const anchorAt = (value: string): Anchor => ({
	branch: 'main',
	commit: value,
	entityId,
	version: null,
	imageSha256: null,
	state: null,
	viewport: null,
	region: null
});
const seeded: CollaborationRecords = {
	schemaVersion: 1,
	projects: [
		{
			id: projectId,
			name: 'Pilot',
			sourceRepository,
			createdAt: '2026-11-01T08:00:00.000Z',
			ownerId: owner.id
		}
	],
	members: [
		{ projectId, actorId: owner.id, email: owner.email, name: owner.name, role: 'owner' },
		{ projectId, actorId: writer.id, email: writer.email, name: writer.name, role: 'writer' },
		{
			projectId,
			actorId: commenter.id,
			email: commenter.email,
			name: commenter.name,
			role: 'commenter'
		},
		{ projectId, actorId: viewer.id, email: viewer.email, name: viewer.name, role: 'viewer' }
	],
	invitations: [],
	threads: []
};
const reachable = new Set([commit, revised]);
const refuse = (code: string) => Object.assign(new Error(`Collaboration ${code}`), { code });
/** addComment asks the source only to validate an anchor, so its other reads are never called. */
const source: SourceAdapter = {
	resolve: async () => ({ commit, tree: 'c'.repeat(40) }),
	tree: async () => [],
	read: async () => new Uint8Array(),
	validateAnchor: async (_repository, anchor) => {
		if (!reachable.has(anchor.commit)) throw refuse('unreachable-anchor');
	}
};
/** An in-memory records branch with the dependencies addComment receives and a fixed clock. */
function recordsBranch() {
	let revision = 1;
	let records = seeded;
	const repository: CollaborationRepository = {
		read: async () => ({ revision: revisionOf(revision), records }),
		async compareAndSwap(expected, next) {
			if (expected !== revisionOf(revision)) return null;
			revision += 1;
			records = next;
			return revisionOf(revision);
		}
	};
	const deps: CollaborationDependencies = {
		repository,
		source,
		cache: { get: async () => null, put: async () => {}, delete: async () => {} },
		authorizeRepository: async () => sourceRepository,
		now: () => new Date('2026-11-15T09:00:00.000Z')
	};
	return { deps, revision: () => revisionOf(revision), threads: () => records.threads };
}
/** A comment as a client sends it: the project, a numbered request, an anchor and its text. */
const draft = (n: number, text: string, extra: Partial<AddCommentInput> = {}): AddCommentInput => ({
	projectId,
	requestId: request(n),
	anchor: anchorAt(commit),
	text,
	...extra
});
/** What a caller reads from a committed thread: where it is, what it says and its revision. */
function summary(thread: CommittedThread) {
	return {
		threadId: thread.id,
		anchor: { entityId: thread.anchor.entityId, commit: thread.anchor.commit },
		comments: thread.comments.map(({ requestId, actor, text, createdAt }) => ({
			requestId,
			actorId: actor.id,
			text,
			createdAt
		})),
		collaborationCommit: thread.collaborationCommit
	};
}
/** One call as a caller makes it: the real addComment, with its result or its refusal kept. */
async function call(deps: CollaborationDependencies, who: Actor, input: AddCommentInput) {
	try {
		return { output: summary(await addComment(deps, who, input)) };
	} catch (error) {
		if (error instanceof Error && 'code' in error)
			return { error: { code: String(error.code), message: error.message } };
		throw error;
	}
}
type Outcome = Awaited<ReturnType<typeof call>>;
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
