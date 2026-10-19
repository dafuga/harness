import { z } from 'zod';
import type {
	GitHubOptions,
	RepositoryIdentity,
	SourceAdapter,
	SourceHistoryAdapter,
	SourceCommit,
	SourceEntry
} from '../models/Collaboration.types';
import { digest, fail, parse, safePath, sha } from './parseCollaborationInput';
import { decode64, exactRef, githubTransport } from './githubTransport';
import { githubLfs } from './githubLfs';
import { githubHistory } from './githubHistory';
import { githubRawMany } from './githubRawMany';
import { validateGitHubAnchor } from './validateGitHubAnchor';
type Options = Omit<GitHubOptions, 'repository'>;
const client = (options: Options, repository: RepositoryIdentity) =>
	githubTransport({ ...options, repository }, 'read');
const entry = z.object({
	path: z.string(),
	sha,
	type: z.enum(['blob', 'tree', 'commit']),
	mode: z.string(),
	size: z.number().optional()
});
async function resolveCommit(options: Options, repository: RepositoryIdentity, ref: string) {
	const api = client(options, repository);
	await api.check();
	const commit = /^[a-f0-9]{40}$/.test(ref) ? ref : await exactRef(api, ref);
	const value = parse(
		z.object({ sha, tree: z.object({ sha }) }),
		(await api.request(`/git/commits/${commit}`)).data
	);
	if (value.sha !== commit) return fail('commit-mismatch');
	return { commit, tree: value.tree.sha };
}
async function treeFiles(
	adapter: SourceAdapter,
	options: Options,
	repository: RepositoryIdentity,
	commit: string
) {
	const revision = await adapter.resolve(repository, parse(sha, commit));
	const value = parse(
		z.object({ sha, truncated: z.boolean(), tree: z.array(entry) }),
		(await client(options, repository).request(`/git/trees/${revision.tree}?recursive=1`)).data
	);
	if (value.truncated) return fail('truncated-tree');
	if (value.sha !== revision.tree) return fail('tree-mismatch');
	const paths = value.tree.map((item) => safePath(item.path));
	if (new Set(paths).size !== paths.length) return fail('invalid-tree');
	return value.tree;
}
async function readBytes(
	adapter: SourceAdapter,
	options: Options,
	repository: RepositoryIdentity,
	input: { commit: string; path: string }
) {
	safePath(input.path);
	const item = (await adapter.tree(repository, input.commit)).find((e) => e.path === input.path);
	if (!item || item.type !== 'blob' || !['100644', '100755'].includes(item.mode))
		return fail('not-found');
	const blob = parse(
		z.object({ sha, size: z.number(), encoding: z.literal('base64'), content: z.string() }),
		(await client(options, repository).request(`/git/blobs/${item.sha}`)).data
	);
	const bytes = decode64(blob.content);
	const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
	const encoded = new Uint8Array(header.length + bytes.length);
	encoded.set(header);
	encoded.set(bytes, header.length);
	if (
		blob.sha !== item.sha ||
		blob.size !== bytes.length ||
		(await digest(encoded, 'SHA-1')) !== item.sha
	)
		return fail('blob-integrity');
	return bytes;
}
function memo<T>(cache: Map<string, Promise<T>>, key: string, read: () => Promise<T>): Promise<T> {
	const existing = cache.get(key);
	if (existing) return existing;
	const pending = read().catch((error: unknown) => {
		cache.delete(key);
		throw error;
	});
	cache.set(key, pending);
	return pending;
}
/** Construct per authenticated request. Only immutable commit/tree/blob reads are memoized. */
export function createGitHubSource(options: Options): SourceHistoryAdapter {
	const commits = new Map<string, Promise<SourceCommit>>(),
		trees = new Map<string, Promise<SourceEntry[]>>(),
		blobs = new Map<string, Promise<Uint8Array>>(),
		materialized = new Map<string, Promise<Uint8Array>>();
	const key = (repo: RepositoryIdentity, ref: string) => `${JSON.stringify(repo)}:${ref}`;
	const raw: SourceHistoryAdapter['raw'] = async (repo, input) => {
		const bytes = await memo(blobs, key(repo, `${input.commit}:${input.path}`), () =>
			readBytes(adapter, options, repo, input)
		);
		return new Uint8Array(bytes);
	};
	const adapter: SourceAdapter = {
		async resolve(repo, ref) {
			const value = /^[a-f0-9]{40}$/.test(ref)
				? await memo(commits, key(repo, ref), () => resolveCommit(options, repo, ref))
				: await resolveCommit(options, repo, ref);
			return { ...value };
		},
		async tree(repo, commit) {
			const values = await memo(trees, key(repo, commit), () =>
				treeFiles(adapter, options, repo, commit)
			);
			return values.map((value) => ({ ...value }));
		},
		async read(repo, input) {
			const bytes = await memo(materialized, key(repo, `${input.commit}:${input.path}`), async () =>
				githubLfs({ ...options, repository: repo }, await raw(repo, input))
			);
			return new Uint8Array(bytes);
		},
		async validateAnchor(repo, anchor) {
			await validateGitHubAnchor({ adapter, client: client(options, repo) }, repo, anchor);
		}
	};
	return {
		...adapter,
		raw,
		rawMany: githubRawMany({ adapter, options, cache: blobs, key }),
		releaseBytes(repo, input) {
			const id = key(repo, `${input.commit}:${input.path}`);
			blobs.delete(id);
			materialized.delete(id);
		},
		...githubHistory(adapter, options)
	};
}
