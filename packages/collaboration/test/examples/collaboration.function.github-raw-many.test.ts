import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { githubRawMany } from '../../src/utils/git-source-history/create-git-hub-source/githubRawMany';
import type { Context } from '../../src/utils/git-source-history/create-git-hub-source/githubRawMany.types';
import type {
	RepositoryIdentity,
	SourceAdapter,
	SourceEntry
} from '../../src/models/planning-collaboration/Collaboration.types';

const repository: RepositoryIdentity = {
	id: 7,
	owner: 'example-org',
	name: 'example-repo',
	private: false,
	installationId: 3
};
const commit = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const decoder = new TextDecoder();

async function unused(): Promise<never> {
	throw new Error('not used by githubRawMany');
}

function blob(path: string, mode = '100644'): SourceEntry {
	return { path, sha: 'b'.repeat(40), type: 'blob', mode };
}

/** A context whose tree comes from `entries` and whose GitHub fetch always fails offline. */
function makeContext(entries: SourceEntry[]) {
	const requests: string[] = [];
	const adapter: SourceAdapter = {
		resolve: unused,
		read: unused,
		validateAnchor: unused,
		tree: async () => entries
	};
	const context: Context = {
		adapter,
		options: {
			token: async () => 'example-token',
			fetch: async () => {
				requests.push('fetch');
				throw new Error('offline example');
			}
		},
		cache: new Map(),
		key: (repo, ref) => `${repo.id}:${ref}`
	};
	return { context, requests };
}

/** Puts already-settled raw bytes for `path` into the shared cache and returns the stored bytes. */
function seed(context: Context, path: string, text: string) {
	const bytes = new TextEncoder().encode(text);
	context.cache.set(context.key(repository, `${commit}:${path}`), Promise.resolve(bytes));
	return bytes;
}

function describeError(error: unknown) {
	const { code = 'none', name = 'unknown' } = (error ?? {}) as { code?: string; name?: string };
	return { name, code };
}

function failureOf(promise: Promise<unknown>) {
	return promise.then(
		() => undefined,
		(error: unknown) => error
	);
}

function meta(state: string) {
	return {
		unitId: 'collaboration.function.github-raw-many',
		symbol: 'githubRawMany',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Reads cached bytes for each path without a GitHub request', async () => {
	const paths = ['docs/readme.md', 'src/index.ts'];
	const { context, requests } = makeContext([blob(paths[0]), blob(paths[1])]);
	const readme = seed(context, paths[0], '# Readme');
	seed(context, paths[1], 'export {};');
	const result = await githubRawMany(context)(repository, { commit, paths });
	const summary = Object.fromEntries(
		[...result].map(([path, bytes]) => [path, decoder.decode(bytes)])
	);

	expect(requests).toEqual([]);
	expect(summary).toEqual({ 'docs/readme.md': '# Readme', 'src/index.ts': 'export {};' });
	result.get(paths[0])?.fill(0);
	expect(decoder.decode(readme)).toBe('# Readme');
	recordExampleCases(meta('reads-cached-bytes-for-each-path-without-a-github-request'), [
		{ name: 'read two paths that are already cached', input: { commit, paths }, output: summary }
	]);
});

test('Rejects a commit that is not a lowercase 40-char sha', async () => {
	const paths = ['docs/readme.md'];
	const { context, requests } = makeContext([blob(paths[0])]);
	const read = githubRawMany(context);
	const inputs = [
		{ commit: commit.toUpperCase(), paths },
		{ commit: 'a1b2c3', paths }
	];
	const failures = await Promise.all(inputs.map((input) => failureOf(read(repository, input))));

	expect(failures).toMatchObject([{ code: 'invalid-input' }, { code: 'invalid-input' }]);
	expect(requests).toEqual([]);
	recordExampleCases(meta('rejects-a-commit-that-is-not-a-lowercase-40-char-sha'), [
		{ name: 'uppercase form of a valid sha', input: inputs[0], error: describeError(failures[0]) },
		{ name: 'six-character abbreviated sha', input: inputs[1], error: describeError(failures[1]) }
	]);
});

test('Rejects a path that is absent from the tree as not-found', async () => {
	const { context, requests } = makeContext([blob('docs/readme.md'), blob('link.md', '120000')]);
	const read = githubRawMany(context);
	const absent = { commit, paths: ['src/index.ts'] };
	const symlink = { commit, paths: ['link.md'] };
	const [a, b] = await Promise.all(
		[absent, symlink].map((input) => failureOf(read(repository, input)))
	);

	expect([a, b]).toMatchObject([{ code: 'not-found' }, { code: 'not-found' }]);
	expect(requests).toEqual([]);
	recordExampleCases(meta('rejects-a-path-that-is-absent-from-the-tree-as-not-found'), [
		{ name: 'path missing from the tree', input: absent, error: describeError(a) },
		{ name: 'path is a symlink (mode 120000)', input: symlink, error: describeError(b) }
	]);
});

test('Drops rejected cache entries when a batch request fails', async () => {
	const paths = ['docs/readme.md'];
	const { context, requests } = makeContext([blob(paths[0])]);
	const key = context.key(repository, `${commit}:${paths[0]}`);
	const failure = await failureOf(githubRawMany(context)(repository, { commit, paths }));

	expect(failure).toMatchObject({ code: 'github-unavailable' });
	expect(context.cache.has(key)).toBe(false);
	expect(requests).toHaveLength(1);
	recordExampleCases(meta('drops-rejected-cache-entries-when-a-batch-request-fails'), [
		{
			name: 'request one uncached path while GitHub is offline',
			input: { commit, paths },
			error: describeError(failure)
		},
		{
			name: 'cache entry after the rejected batch',
			input: { key },
			output: { cached: context.cache.has(key) }
		}
	]);
});

test('Returns an empty map for an empty paths list', async () => {
	const { context, requests } = makeContext([]);
	const result = await githubRawMany(context)(repository, { commit, paths: [] });

	expect(result.size).toBe(0);
	expect(requests).toEqual([]);
	recordExampleCases(meta('returns-an-empty-map-for-an-empty-paths-list'), [
		{ name: 'read no paths', input: { commit, paths: [] }, output: { size: result.size } }
	]);
});
