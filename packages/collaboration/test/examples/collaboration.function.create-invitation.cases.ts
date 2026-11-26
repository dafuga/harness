import { test } from 'vitest';
import { createInvitation } from '../../src/utils/projects-sessions/create-collaboration/createInvitation';
import type {
	Actor,
	CollaborationDependencies,
	CollaborationRecords,
	CollaborationRepository,
	Member,
	StoredInvitation
} from '../../src/models/planning-collaboration/Collaboration.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

export const projectId = '90a2c6c7-238d-4f87-9f62-1ec17a7d0012';
export const now = '2026-11-15T12:00:00.000Z';
export const actor = (id: string, email: string, name: string): Actor => ({
	id,
	email,
	name,
	emailVerified: true
});
export const owner = actor('actor_alex_01', 'alex@example.com', 'Alex Rivera');
export const writer = actor('actor_writer_03', 'jules@example.net', 'Jules Morgan');
const repositoryIdentity = {
	id: 84235671,
	owner: 'acme-build',
	name: 'launch-planning',
	private: true,
	installationId: 5720001
};
const project = {
	id: projectId,
	name: 'Launch planning',
	sourceRepository: repositoryIdentity,
	createdAt: '2026-10-20T09:30:00.000Z',
	ownerId: owner.id
};
export const member = (actor: Actor, role: Member['role']): Member => ({
	projectId,
	actorId: actor.id,
	email: actor.email,
	name: actor.name,
	role
});
export const ownerMember = member(owner, 'owner');
export const writerMember = member(writer, 'writer');
const revision = (n: number) => n.toString(16).padStart(40, '0');

export function recordsBranch(
	members: Member[] = [ownerMember],
	invitations: StoredInvitation[] = [],
	conflict = false
) {
	let currentRevision = 1;
	let records: CollaborationRecords = {
		schemaVersion: 1,
		projects: [project],
		members,
		invitations,
		threads: []
	};
	const repository: CollaborationRepository = {
		async read() {
			return { revision: revision(currentRevision), records };
		},
		async compareAndSwap(expected, next) {
			if (conflict) return null;
			if (expected !== revision(currentRevision)) return null;
			records = next;
			currentRevision++;
			return revision(currentRevision);
		}
	};
	const deps: CollaborationDependencies = {
		repository,
		source: {
			resolve: async () => ({ commit: 'a'.repeat(40), tree: 'b'.repeat(40) }),
			tree: async () => [],
			read: async () => new Uint8Array(),
			validateAnchor: async () => {}
		},
		cache: { get: async () => null, put: async () => {}, delete: async () => {} },
		authorizeRepository: async () => repositoryIdentity,
		now: () => new Date(now)
	};
	return { deps, records: () => records, revision: () => revision(currentRevision) };
}

export async function codeDigest(code: string) {
	const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function errorSummary(error: unknown) {
	if (!(error instanceof Error)) return { message: String(error) };
	return { code: 'code' in error ? String(error.code) : null, message: error.message };
}

export async function capture<T>(call: Promise<T>) {
	try {
		return { output: await call };
	} catch (error) {
		return { error: errorSummary(error) };
	}
}

export function evidence(symbol: string, state: string) {
	return {
		unitId: 'collaboration.function.create-invitation',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('creates a hashed one-day invitation for an owner', async () => {
	const store = recordsBranch([ownerMember, writerMember]);
	const input = { projectId, email: 'Sam@Example.com', role: 'writer' as const };
	const issued = await createInvitation(store.deps, owner, input);
	const refusalInput = { projectId, email: 'lee@example.org', role: 'viewer' as const };
	const refused = await capture(createInvitation(store.deps, writer, refusalInput));
	const stored = store.records().invitations[0];
	const state = 'creates-a-hashed-one-day-invitation-for-an-owner';
	recordExampleCases(evidence('createInvitation', state), [
		{
			name: 'project owner invites Sam with a mixed-case email',
			input: { actor: owner, input, now },
			output: {
				invitation: issued,
				stored: {
					id: stored.id,
					email: stored.email,
					role: stored.role,
					expiresAt: stored.expiresAt,
					codeHash: stored.codeHash,
					acceptedBy: stored.acceptedBy
				}
			}
		},
		{
			name: 'project writer cannot issue another invitation',
			input: { actor: writer, input: refusalInput, now },
			...refused
		}
	]);
	const expiresAt = new Date(Date.parse(now) + 86400000).toISOString();
	expect(issued).toMatchObject({
		id: expect.stringMatching(/^[0-9a-f-]{36}$/),
		projectId,
		expiresAt
	});
	expect(issued.code).toMatch(/^[a-f0-9]{64}$/);
	expect(stored).toMatchObject({ email: 'sam@example.com', role: 'writer', acceptedBy: null });
	expect(stored.codeHash).toBe(await codeDigest(issued.code));
	expect(refused.error).toEqual({ code: 'forbidden', message: 'Collaboration forbidden' });
	expect(store.records().invitations).toHaveLength(1);
	expect(store.revision()).toBe(revision(2));
});
