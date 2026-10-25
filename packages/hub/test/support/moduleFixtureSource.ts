import type { RepositoryIdentity, SourceHistoryAdapter } from 'collaboration';
import type { ModuleDataIdentity } from '../../../../src/repositories/git-source-history/ModuleDataRepository.types';
import {
	moduleDataProducer,
	moduleDataRef
} from '../../../../src/services/git-source-history/module-data-service/moduleDataProtocol';
import { moduleFixtureSnapshot, fixtureDigest, blobHash } from './moduleFixtureSnapshot';

/** Publish fixture metadata on a separate immutable object tree; never alter source or evidence. */
export function moduleFixtureSource(source: SourceHistoryAdapter): SourceHistoryAdapter {
	const resolved = new Map<number, Map<string, string>>();
	const virtual = new Map<string, Map<string, Uint8Array>>();
	const metadata = fixtureMetadata(source, resolved, virtual);
	const read: SourceHistoryAdapter['read'] = async (repository, input) => {
		const files = virtual.get(input.commit);
		if (!files) return source.read(repository, input);
		const bytes = files.get(input.path);
		if (!bytes) throw new Error('Missing fixture metadata');
		return new Uint8Array(bytes);
	};
	return {
		...source,
		resolve: async (repository, ref) => {
			const revision = await source.resolve(repository, ref);
			const commits = resolved.get(repository.id) ?? new Map<string, string>();
			commits.set(revision.commit, revision.tree);
			resolved.set(repository.id, commits);
			return revision;
		},
		optionalRef: (repository, ref) =>
			ref === moduleDataRef ? metadata(repository) : source.optionalRef(repository, ref),
		tree: async (repository, commit) => {
			const files = virtual.get(commit);
			if (!files && !resolved.get(repository.id)?.has(commit)) {
				const revision = await source.resolve(repository, commit);
				const commits = resolved.get(repository.id) ?? new Map<string, string>();
				commits.set(revision.commit, revision.tree);
				resolved.set(repository.id, commits);
			}
			return files
				? [...files].map(([path, bytes]) => ({
						path,
						sha: blobHash(bytes),
						type: 'blob',
						mode: '100644',
						size: bytes.length
					}))
				: source.tree(repository, commit);
		},
		read,
		raw: (repository, input) =>
			virtual.has(input.commit)
				? read(repository, input)
				: (source.raw ?? source.read)(repository, input)
	};
}

function fixtureSnapshots(source: SourceHistoryAdapter) {
	const snapshots = new Map<string, ReturnType<typeof moduleFixtureSnapshot>>();
	return async (repository: RepositoryIdentity, identity: ModuleDataIdentity) => {
		const key = `${repository.id}:${fixtureDigest(identity)}`;
		let pending = snapshots.get(key);
		if (!pending) {
			pending = (async () => {
				const files = new Map<string, Uint8Array>();
				for (const entry of await source.tree(repository, identity.commit)) {
					if (entry.type !== 'blob') continue;
					const bytes = await (source.raw ?? source.read)(repository, {
						commit: identity.commit,
						path: entry.path
					});
					if (blobHash(bytes) !== entry.sha) throw new Error('Invalid fixture source blob');
					files.set(entry.path, bytes);
				}
				return moduleFixtureSnapshot(identity, files);
			})();
			snapshots.set(key, pending);
		}
		return pending;
	};
}

function fixtureMetadata(
	source: SourceHistoryAdapter,
	resolved: Map<number, Map<string, string>>,
	virtual: Map<string, Map<string, Uint8Array>>
) {
	const snapshot = fixtureSnapshots(source);
	const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
	return async (repository: RepositoryIdentity) => {
		const notes = await source.optionalRef(repository, 'refs/notes/harness');
		const evidence = await source.optionalRef(repository, 'refs/heads/harness-evidence');
		const files = new Map<string, Uint8Array>();
		for (const [commit, tree] of resolved.get(repository.id) ?? []) {
			const identity = {
				commit,
				tree,
				inputs: { notes: notes?.commit ?? null, evidence: evidence?.commit ?? null }
			};
			const data = await snapshot(repository, identity);
			const key = fixtureDigest({ producer: moduleDataProducer, ...identity });
			files.set(`modules/${commit}/${key}.json`, encode(data));
		}
		const tree = fixtureDigest([...files].map(([path, bytes]) => [path, blobHash(bytes)])).slice(
			0,
			40
		);
		const commit = fixtureDigest({ repository: repository.id, tree }).slice(0, 40);
		virtual.set(commit, files);
		return { commit, tree };
	};
}
