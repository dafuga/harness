import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type {
	Actor,
	ProjectSummary,
	SourceHistoryAdapter,
	CacheIdentity,
	CacheEntry,
	CollaborationRecords
} from 'collaboration';
import { createCollaboration } from 'collaboration';
import { hubCache } from '../../src/routes/api/[...path]/-server/hubCache';
import { HubProjectionService } from '../../src/services/hub-projection-service/HubProjectionService';
import { HubApiController } from '../../src/controllers/hub-api-controller/HubApiController';
const encode = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
export const actor: Actor = {
	id: 'google:fixture-one',
	email: 'owner@gmail.com',
	name: 'Owner',
	emailVerified: true
};
export const outsider: Actor = {
	id: 'google:fixture-two',
	email: 'other@gmail.com',
	name: 'Other',
	emailVerified: true
};
export const commit = 'a'.repeat(40),
	tree = 'b'.repeat(40),
	notes = 'c'.repeat(40),
	evidence = 'd'.repeat(40);
export const project: ProjectSummary = {
	id: 'a6196e55-8746-4bc5-bfeb-5e2c8771e241',
	name: 'Harness',
	ownerId: actor.id,
	createdAt: '2026-10-12T00:00:00Z',
	role: 'owner',
	sourceRepository: { id: 1, installationId: 2, owner: 'fixture', name: 'harness', private: true }
};
export const unit = JSON.parse(
	readFileSync(
		new URL('../../../../specification/units/desktop.page.harness-path.json', import.meta.url),
		'utf8'
	)
) as { id: string; title: string };
export const unitPath = 'specification/units/' + unit.id + '.json';
export function projectionFixture() {
	let revision = 'e'.repeat(40),
		activeActor: Actor | null = actor;
	const records = fixtureRecords();
	const files = new Map([
		[unitPath, encode(unit)],
		[
			'packages/desktop/src/routes/harness/[...path]/+page.svelte',
			new TextEncoder().encode('<h1>Harness</h1>')
		]
	]);
	const cache = hubCache();
	const source = projectionSource(files);
	const repository = {
		read: async () => ({ revision, records: structuredClone(records) }),
		compareAndSwap: async (expected: string, value: typeof records) => {
			if (expected !== revision) return null;
			Object.assign(records, value);
			revision = 'f'.repeat(40);
			return revision;
		}
	};
	const api = createCollaboration({
		source,
		cache,
		repository,
		authorizeRepository: async () => project.sourceRepository
	});
	const projection = new HubProjectionService({ source, cache, api });
	const controller = new HubApiController({
		auth: { actor: async () => activeActor, handle: async () => null },
		connect: () => ({ api, projection })
	});
	return {
		source,
		files,
		cache,
		api,
		projection,
		controller,
		records,
		setActor: (next: Actor | null) => {
			activeActor = next;
		}
	};
}
export function cacheEnvelope(identity: CacheIdentity, bytes: Uint8Array): CacheEntry {
	return { identity, bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export function projectionSource(files: Map<string, Uint8Array>): SourceHistoryAdapter {
	return {
		raw: async (_repo, input) => {
			const value = files.get(input.path);
			if (!value) throw Error('Missing');
			return new Uint8Array(value);
		},
		resolve: async (repo, ref) => {
			if (repo.id !== 1) throw Error('Wrong repo');
			return { commit: /^[a-f0-9]{40}$/.test(ref) ? ref : commit, tree };
		},
		tree: async () =>
			[...files].map(([path, bytes]) => ({
				path,
				sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
				type: 'blob' as const,
				mode: '100644',
				size: bytes.length
			})),
		read: async (_repo, input) => {
			const value = files.get(input.path);
			if (!value) throw Error('Missing');
			return new Uint8Array(value);
		},
		validateAnchor: async () => {},
		branches: async () => [{ name: 'feat/a/b', tip: commit }],
		commits: async (_r, input) => {
			if (input.branch !== 'feat/a/b') throw Error('Invalid branch');
			return [{ hash: commit, subject: 'feat: tested', authoredAt: '2026-10-12T00:00:00Z' }];
		},
		changed: async () => [...files.keys()],
		historyPage: async () => ({
			commits: [{ hash: commit, subject: 'feat: tested', authoredAt: '2026-10-12T00:00:00Z' }],
			complete: true,
			nextPage: null
		}),
		optionalRef: async (_r, ref) => ({
			commit: ref === 'refs/notes/harness' ? notes : evidence,
			tree
		})
	};
}

function fixtureRecords(): CollaborationRecords {
	return {
		schemaVersion: 1 as const,
		projects: [
			{
				id: project.id,
				name: project.name,
				ownerId: project.ownerId,
				createdAt: project.createdAt,
				sourceRepository: project.sourceRepository
			}
		],
		members: [
			{
				projectId: project.id,
				actorId: actor.id,
				email: actor.email,
				name: actor.name,
				role: 'owner' as const
			}
		],
		invitations: [],
		threads: []
	};
}
