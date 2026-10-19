import type {
	GitHubOptions,
	RepositoryIdentity,
	SourceAdapter,
	SourceHistoryAdapter,
	SourceEntry
} from '../models/Collaboration.types';
import { fail, parse, safePath, sha } from './parseCollaborationInput';
import { githubGraphql } from './githubGraphql';
interface Context {
	adapter: SourceAdapter;
	options: Omit<GitHubOptions, 'repository'>;
	cache: Map<string, Promise<Uint8Array>>;
	key(repo: RepositoryIdentity, ref: string): string;
}
function attestPaths(entries: SourceEntry[], paths: string[]) {
	const tree = new Map(entries.map((entry) => [entry.path, entry]));
	return [...new Set(paths.map(safePath))].map((path) => {
		const entry = tree.get(path);
		if (!entry || entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode))
			return fail('not-found');
		return entry;
	});
}
function stage(
	context: Context,
	repository: RepositoryIdentity,
	commit: string,
	entries: SourceEntry[]
) {
	const missing = entries.filter(
		(entry) => !context.cache.has(context.key(repository, `${commit}:${entry.path}`))
	);
	if (!missing.length) return;
	const loaded = githubGraphql({ ...context.options, repository }, { commit, entries: missing });
	for (const entry of missing) {
		const key = context.key(repository, `${commit}:${entry.path}`);
		const pending = loaded
			.then((values) => values.get(entry.path) ?? fail('blob-integrity'))
			.catch((error: unknown) => {
				context.cache.delete(key);
				throw error;
			});
		context.cache.set(key, pending);
	}
}
/** Shares immutable raw promises with individual raw/read calls; batches at most 64 paths. */
export function githubRawMany(context: Context): NonNullable<SourceHistoryAdapter['rawMany']> {
	return async (repository, input) => {
		parse(sha, input.commit);
		const entries = attestPaths(await context.adapter.tree(repository, input.commit), input.paths);
		const result = new Map<string, Uint8Array>();
		for (let offset = 0; offset < entries.length; offset += 64) {
			const batch = entries.slice(offset, offset + 64);
			stage(context, repository, input.commit, batch);
			await Promise.all(
				batch.map(async (entry) => {
					const bytes = await context.cache.get(
						context.key(repository, `${input.commit}:${entry.path}`)
					)!;
					result.set(entry.path, new Uint8Array(bytes));
				})
			);
		}
		return result;
	};
}
