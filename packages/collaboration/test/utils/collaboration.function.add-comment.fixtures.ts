import { addComment } from '../../src/utils/projects-sessions/create-collaboration/addComment';
import type {
	Actor,
	AddCommentInput,
	Anchor,
	CollaborationDependencies,
	CollaborationRecords,
	CollaborationRepository,
	CommittedThread,
	SourceAdapter
} from '../../src/models/planning-collaboration/Collaboration.types';

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
export const owner = person('owner', 'Owner');
export const writer = person('writer', 'Writer');
export const commenter = person('commenter', 'Commenter');
export const viewer = person('viewer', 'Viewer');
const projectId = '6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
export const entityId = 'desktop.function.compose-modes';
const sourceRepository = {
	id: 202,
	owner: 'acme',
	name: 'pilot',
	private: true,
	installationId: 7
};
/** Two commits the branch reaches, and one it does not. */
export const commit = '9f2c4e1a'.repeat(5);
export const revised = '4b7d1e9c'.repeat(5);
export const unreachable = 'deadbeef'.repeat(5);
/** A numbered request ID: a valid UUID that is the same on every run. */
const request = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const unknownThread = request(99);
/** A committed revision is named by its count, as a commit is named by its hash. */
export const revisionOf = (count: number) => count.toString(16).padStart(40, '0');
export const anchorAt = (value: string): Anchor => ({
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
export function recordsBranch() {
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
export const draft = (
	n: number,
	text: string,
	extra: Partial<AddCommentInput> = {}
): AddCommentInput => ({
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
export async function call(deps: CollaborationDependencies, who: Actor, input: AddCommentInput) {
	try {
		return { output: summary(await addComment(deps, who, input)) };
	} catch (error) {
		if (error instanceof Error && 'code' in error)
			return { error: { code: String(error.code), message: error.message } };
		throw error;
	}
}
