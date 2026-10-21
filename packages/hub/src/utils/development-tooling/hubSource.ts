import { hubRaw, hubMaterializedHash, hubBlobProfile } from './hubRaw';
import { readCache, writeCache } from 'collaboration';
import type {
	Actor,
	CacheIdentity,
	CollaborationCache,
	Project,
	SourceEntry,
	SourceHistoryAdapter
} from 'collaboration';
import { hubFail } from './hubJson';
export interface HubSourceContext {
	metadata?: Map<string, Uint8Array>;
	metadataPending?: Promise<void>;
	source: SourceHistoryAdapter;
	repository: Project['sourceRepository'];
	commit: string;
	entries: SourceEntry[];
	identity: CacheIdentity;
	cache: CollaborationCache;
}
export async function hubSource(input: {
	source: SourceHistoryAdapter;
	cache: CollaborationCache;
	actor: Actor;
	project: Project & { collaborationCommit?: string };
	ref: string;
}): Promise<HubSourceContext> {
	const repository = input.project.sourceRepository;
	const [revision, notes, evidence] = await Promise.all([
		input.source.resolve(repository, input.ref),
		input.source.optionalRef(repository, 'refs/notes/harness'),
		input.source.optionalRef(repository, 'refs/heads/harness-evidence')
	]);
	return {
		source: input.source,
		repository,
		commit: revision.commit,
		cache: input.cache,
		entries: await input.source.tree(repository, revision.commit),
		identity: {
			principalId: input.actor.id,
			projectId: input.project.id,
			repositoryId: repository.id,
			requestedRef: input.ref,
			sourceCommit: revision.commit,
			sourceTree: revision.tree,
			notesRef: 'refs/notes/harness',
			notesRevision: notes?.commit ?? null,
			evidenceRef: 'refs/heads/harness-evidence',
			evidenceRevision: evidence?.commit ?? null,
			historyIndexRevision: null,
			collaborationRevision: input.project.collaborationCommit ?? null,
			artifactHash: null,
			profile: null
		}
	};
}
export async function hubRead(
	context: HubSourceContext,
	path: string,
	hash: string | null = null
): Promise<Uint8Array> {
	const entry = context.entries.find(
		(e) => e.path === path && e.type === 'blob' && ['100644', '100755'].includes(e.mode)
	);
	if (!entry) return hubFail('not-found');
	const raw = await hubRaw(context, entry),
		binding = await hubMaterializedHash(raw, hash);
	if (!binding.lfs) return raw;
	const identity = {
		...context.identity,
		artifactHash: binding.hash,
		profile: await hubBlobProfile('source', path, entry.sha)
	};
	const cached = await readCache(context.cache, identity);
	if (cached && cached.length === binding.size) return cached;
	const bytes = await context.source.read(context.repository, { commit: context.commit, path });
	if (bytes.length !== binding.size) return hubFail();
	await writeCache(context.cache, identity, bytes);
	return bytes;
}
