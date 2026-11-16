import { test } from 'vitest';
import { githubRawMany } from '../../src/utils/git-source-history/create-git-hub-source/githubRawMany';
import type { Context } from '../../src/utils/git-source-history/create-git-hub-source/githubRawMany.types';
import type {
	RepositoryIdentity,
	SourceAdapter,
	SourceEntry
} from '../../src/models/planning-collaboration/Collaboration.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

async function gitBlobSha(text: string): Promise<string> {
	const content = new TextEncoder().encode(text);
	const header = new TextEncoder().encode(`blob ${content.length}\0`);
	const blob = new Uint8Array(header.length + content.length);
	blob.set(header);
	blob.set(content, header.length);
	const digest = await crypto.subtle.digest('SHA-1', blob);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function recordingFetch(input: {
	repository: RepositoryIdentity;
	commit: string;
	fetchedPath: string;
	fetchedText: string;
	fetchedSha: string;
	requests: unknown[];
}): NonNullable<Context['options']['fetch']> {
	const { repository, commit, fetchedPath, fetchedText, fetchedSha, requests } = input;
	return async (input, init) => {
		const body = JSON.parse(String(init?.body)) as { variables: Record<string, string> };
		const prefix = `${commit}:`;
		const paths = Object.values(body.variables)
			.filter((value) => value.startsWith(prefix))
			.map((value) => value.slice(prefix.length));
		requests.push({
			url: String(input),
			method: init?.method,
			authorization: new Headers(init?.headers).get('Authorization'),
			paths
		});
		const data: Record<string, unknown> = { databaseId: repository.id };
		for (const [index, path] of paths.entries()) {
			if (path !== fetchedPath) throw new Error('unexpected GraphQL path');
			data[`b${index}`] = {
				__typename: 'Blob',
				oid: fetchedSha,
				text: fetchedText,
				isBinary: false,
				isTruncated: false,
				byteSize: new TextEncoder().encode(fetchedText).length
			};
		}
		return new Response(JSON.stringify({ data: { repository: data } }), { status: 200 });
	};
}

function createContext(input: {
	repository: RepositoryIdentity;
	commit: string;
	entries: SourceEntry[];
	cachedPath: string;
	cachedBytes: Uint8Array;
	fetchedPath: string;
	fetchedText: string;
	fetchedSha: string;
}) {
	const { repository, commit, cachedPath, cachedBytes } = input;
	const treeCommits: string[] = [];
	const tokenRequests: unknown[] = [];
	const graphqlRequests: unknown[] = [];
	const key = (_repo: RepositoryIdentity, ref: string) => `fixture:${ref}`;
	const cache = new Map<string, Promise<Uint8Array>>([
		[key(repository, `${commit}:${cachedPath}`), Promise.resolve(cachedBytes)]
	]);
	const adapter = {
		async tree(_repository: RepositoryIdentity, requestedCommit: string) {
			treeCommits.push(requestedCommit);
			return input.entries;
		}
	} as SourceAdapter;
	const context: Context = {
		adapter,
		cache,
		key,
		options: {
			async token(request) {
				tokenRequests.push(request);
				return 'example-token';
			},
			fetch: recordingFetch({
				repository,
				commit,
				fetchedPath: input.fetchedPath,
				fetchedText: input.fetchedText,
				fetchedSha: input.fetchedSha,
				requests: graphqlRequests
			})
		}
	};
	return { context, cache, key, treeCommits, tokenRequests, graphqlRequests };
}

async function createSample() {
	const commit = 'a'.repeat(40);
	const repository: RepositoryIdentity = {
		id: 42,
		owner: 'example-org',
		name: 'sample-project',
		private: true,
		installationId: 73
	};
	const cachedPath = 'README.md';
	const fetchedPath = 'src/index.ts';
	const cachedText = '# Sample project\n';
	const fetchedText = 'export const answer = 42;\n';
	const [cachedSha, fetchedSha] = await Promise.all([
		gitBlobSha(cachedText),
		gitBlobSha(fetchedText)
	]);
	const entries: SourceEntry[] = [
		{ path: cachedPath, sha: cachedSha, type: 'blob', mode: '100644', size: cachedText.length },
		{ path: fetchedPath, sha: fetchedSha, type: 'blob', mode: '100755', size: fetchedText.length }
	];
	const cachedBytes = new TextEncoder().encode(cachedText);
	const { context, cache, key, treeCommits, tokenRequests, graphqlRequests } = createContext({
		repository,
		commit,
		entries,
		cachedPath,
		cachedBytes,
		fetchedPath,
		fetchedText,
		fetchedSha
	});
	const input = { commit, paths: [cachedPath, fetchedPath, cachedPath] };
	const result = await githubRawMany(context)(repository, input);
	const files = Array.from(result, ([path, bytes]) => ({
		path,
		text: new TextDecoder().decode(bytes)
	}));
	return {
		repository,
		input,
		files,
		treeCommits,
		tokenRequests,
		graphqlRequests,
		cachedBytes,
		cachedValue: result.get(cachedPath)!,
		fetchedValue: result.get(fetchedPath)!,
		storedFetchedValue: (await cache.get(key(repository, `${commit}:${fetchedPath}`)))!
	};
}

function sampleCases(sample: Awaited<ReturnType<typeof createSample>>) {
	return [
		{
			name: 'a duplicate path reuses cached bytes and fetches the remaining safe blob',
			input: {
				repository: {
					id: sample.repository.id,
					owner: sample.repository.owner,
					name: sample.repository.name
				},
				...sample.input,
				preloadedCachePaths: ['README.md']
			},
			output: {
				files: sample.files,
				treeCommits: sample.treeCommits,
				tokenRequests: sample.tokenRequests,
				graphqlRequests: sample.graphqlRequests,
				returnedBytesAreCopies: {
					cached: sample.cachedValue !== sample.cachedBytes,
					fetched: sample.fetchedValue !== sample.storedFetchedValue
				}
			}
		}
	];
}

test('reads distinct paths from tree while reusing cached bytes', async () => {
	const sample = await createSample();
	const state = 'reads-distinct-paths-from-tree-while-reusing-cached-bytes';
	recordExampleCases(
		{
			unitId: 'collaboration.function.github-raw-many',
			symbol: 'githubRawMany',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		sampleCases(sample)
	);
	expect(sample.files).toEqual([
		{ path: 'README.md', text: '# Sample project\n' },
		{ path: 'src/index.ts', text: 'export const answer = 42;\n' }
	]);
	expect(sample.tokenRequests).toEqual([
		{ installationId: 73, repositoryIds: [42], permissions: { contents: 'read' } }
	]);
	expect(sample.graphqlRequests).toMatchObject([
		{
			url: 'https://api.github.com/graphql',
			method: 'POST',
			authorization: 'Bearer example-token',
			paths: ['src/index.ts']
		}
	]);
	expect(sample.fetchedValue === sample.storedFetchedValue).toBe(false);
});
