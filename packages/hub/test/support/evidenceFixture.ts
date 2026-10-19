import type { Actor, CollaborationCache, CollaborationRecords, Project } from 'collaboration';
import { createCollaboration } from 'collaboration';
import type {
	EntityEvidenceQuery,
	EntityEvidenceResult,
	EvidenceArtifactQuery
} from '../../../desktop/src/models/DesktopEvidence.types';
import { artifactQuery, type EvidenceSide } from '../../../desktop/src/utils/artifactQuery';
import { mediaFile } from '../../../reports/src/utils/harnessEvidence';
import { HubApiController } from '../../src/controllers/hub-api-controller/HubApiController';
import { HubProjectionService } from '../../src/services/hub-projection-service/HubProjectionService';
import { hubCache } from '../../src/routes/api/[...path]/-server/hubCache';
import { hubSource } from '../../src/utils/hubSource';
import { fakeGit, gitSource } from './evidenceGit';
import { evidenceHistory } from './evidenceHistory';
import { page } from './evidenceRecords';
import { actor, outsider } from './projectionFixture';

export { actor, outsider };
export const colleague: Actor = {
	id: 'google:fixture-three',
	email: 'colleague@gmail.com',
	name: 'Colleague',
	emailVerified: true
};
const repository = { installationId: 2, owner: 'fixture', name: 'harness', private: true };
const created = { ownerId: actor.id, createdAt: '2026-10-12T00:00:00Z' };
/** The project whose repository holds the recorded history. */
export const project: Project = {
	id: 'a6196e55-8746-4bc5-bfeb-5e2c8771e241',
	name: 'Harness',
	...created,
	sourceRepository: { ...repository, id: 1 }
};
/** Another project of the same owner: the same commits, and neither notes nor evidence. */
export const other: Project = {
	id: 'b7207f66-9857-4cd6-8afc-6f3d9882f352',
	name: 'Clone',
	...created,
	sourceRepository: { ...repository, id: 2, name: 'clone' }
};

function memberships(): CollaborationRecords {
	const member = (projectId: string, who: Actor, role: 'owner' | 'viewer') => ({
		projectId,
		actorId: who.id,
		email: who.email,
		name: who.name,
		role
	});
	return {
		schemaVersion: 1,
		projects: [project, other],
		members: [
			member(project.id, actor, 'owner'),
			member(project.id, colleague, 'viewer'),
			member(other.id, actor, 'owner')
		],
		invitations: [],
		threads: []
	};
}

/** A cache that says which keys were read, so a test can show that none was. */
function counted(cache: CollaborationCache) {
	const reads: string[] = [];
	const counting: CollaborationCache = {
		...cache,
		get: async (key) => {
			reads.push(key);
			return cache.get(key);
		}
	};
	return { cache: counting, reads };
}

/** The hub over a repository with recorded history, and over a clone that has none. */
export function evidenceFixture(options: { screens?: Uint8Array } = {}) {
	const history = evidenceHistory(options);
	const clone = fakeGit();
	for (const [id, commit] of history.git.commits) clone.commits.set(id, commit);
	for (const [ref, tip] of history.git.refs)
		if (/^refs\/heads\/(main|verified|side)$/.test(ref)) clone.refs.set(ref, tip);
	const { source, calls } = gitSource(
		new Map([
			[1, history.git],
			[2, clone]
		])
	);
	const { cache, reads } = counted(hubCache());
	const shared = memberships();
	let signed: Actor | null = actor;
	const api = createCollaboration({
		source,
		cache,
		repository: {
			read: async () => ({ revision: 'e'.repeat(40), records: structuredClone(shared) }),
			compareAndSwap: async () => null
		},
		authorizeRepository: async () => project.sourceRepository
	});
	const projection = new HubProjectionService({ source, cache, api });
	const controller = new HubApiController({
		auth: { actor: async () => signed, handle: async () => null },
		connect: () => ({ api, projection })
	});
	return {
		...history,
		...{ source, calls, cache, reads, shared, api, projection, controller },
		signIn: (next: Actor | null) => {
			signed = next;
		}
	};
}

export type EvidenceFixture = ReturnType<typeof evidenceFixture>;
type Mode = EntityEvidenceQuery['mode'];
export type Asked = Omit<EntityEvidenceQuery, 'projectId'> & { projectId: string };

/** An evidence read of the page, as the viewer asks for it. */
export function asked(commit: string, branch: string, mode: Mode, entityId = page): Asked {
	return { projectId: project.id, entityId, commit, branch, mode };
}

/** The request for one capture an answer lists, made exactly as the viewer makes it. */
export function bound(
	result: EntityEvidenceResult,
	scope: Asked,
	side: EvidenceSide = 'after'
): EvidenceArtifactQuery & { projectId: string } {
	const listed = result.evidence[side]?.captures[0];
	const query = listed && artifactQuery(result, scope, side, mediaFile(listed.capture));
	if (!query) throw new Error(`The answer lists no stored capture on its ${side} side.`);
	return { ...query, projectId: scope.projectId };
}

/** What a refused read was refused with. */
export async function refusal(read: Promise<unknown>): Promise<string> {
	return read.then(
		() => 'answered',
		(error: unknown) => String((error as { code?: unknown }).code ?? error)
	);
}

/** An evidence read through the hub, as one signed-in person. */
export function read(f: EvidenceFixture, query: Asked, who: Actor = actor) {
	return f.projection.evidence(who, query.projectId, query);
}

/** The bytes of one capture through the hub, as one signed-in person. */
export function bytesOf(
	f: EvidenceFixture,
	query: EvidenceArtifactQuery & { projectId: string },
	who: Actor = actor
) {
	return f.projection.artifact(who, query.projectId, query);
}

/** The reads of objects among what a source was asked: blobs, commits as stated, ancestry. */
export function objectReads(calls: string[]): string[] {
	return calls.filter((call) => /^(blob|facts|reaches) /.test(call));
}

/** The source of the project at one commit, as every hub read opens it for the owner. */
export function sourceAt(f: EvidenceFixture, commit: string, of: Project = project) {
	const { source, cache } = f;
	return hubSource({ source, cache, actor, project: of, ref: commit });
}

/** Ancestry as the source of a fixture states it for the repository of the project. */
export function reachesIn(f: EvidenceFixture) {
	return async (tip: string, commit: string) =>
		(await f.source.reaches?.(project.sourceRepository, { tip, commit })) ?? false;
}
