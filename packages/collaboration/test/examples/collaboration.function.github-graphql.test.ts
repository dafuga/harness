import { createHash } from 'node:crypto';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { githubGraphql } from '../../src/utils/git-source-history/create-git-hub-source/githubGraphql';

type Options = Parameters<typeof githubGraphql>[0];
type Fetch = NonNullable<Options['fetch']>;

const COMMIT = '9d2c4f1a8b7e3f60c5d1a2b3e4f5a6b7c8d9e0f1';
const PATH = 'packages/example/src/value.ts';
const UNAVAILABLE = { message: 'Collaboration github-unavailable', code: 'github-unavailable' };

function bytesOf(text: string): number {
	return new TextEncoder().encode(text).length;
}

/** Git blob SHA-1 over "blob <size>\0" plus the UTF-8 bytes, computed independently of the unit. */
function gitBlobSha(text: string): string {
	return createHash('sha1')
		.update(`blob ${bytesOf(text)}\0`)
		.update(new TextEncoder().encode(text))
		.digest('hex');
}

function blobOf(oid: string, text: string): Record<string, unknown> {
	return {
		__typename: 'Blob',
		oid,
		text,
		isBinary: false,
		isTruncated: false,
		byteSize: bytesOf(text)
	};
}

function envelope(blobs: unknown[], databaseId = 42): object {
	const fields = Object.fromEntries(blobs.map((blob, index) => [`b${index}`, blob]));
	return { data: { repository: { databaseId, ...fields } } };
}

function respondWith(body: unknown, calls: string[]): Fetch {
	return (url) => {
		calls.push(String(url));
		return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
	};
}

function optionsWith(fetch: Fetch): Options {
	return {
		repository: {
			owner: 'example-org',
			name: 'example-repo',
			id: 42,
			installationId: 7,
			private: true
		},
		token: () => Promise.resolve('example-token'),
		fetch
	};
}

function entryOf(sha: string, size: number) {
	return { path: PATH, sha, type: 'blob' as const, mode: '100644', size };
}

async function failureOf(run: Promise<unknown>): Promise<{ message: string; code: unknown }> {
	try {
		await run;
		return { message: 'resolved', code: null };
	} catch (error) {
		const { message, code } = error as { message: string; code: unknown };
		return { message, code };
	}
}

test('Returns verified blob text for a valid batch', async () => {
	const text = 'export const value = 1;\n';
	const sha = gitBlobSha(text);
	const entry = entryOf(sha, bytesOf(text));
	const calls: string[] = [];
	const result = await githubGraphql(
		optionsWith(respondWith(envelope([blobOf(sha, text)]), calls)),
		{
			commit: COMMIT,
			entries: [entry]
		}
	);
	expect(calls).toEqual(['https://api.github.com/graphql']);
	expect([...result.keys()]).toEqual([PATH]);
	expect(new TextDecoder().decode(result.get(PATH))).toBe(text);
	recordExampleCases(
		{
			unitId: 'collaboration.function.github-graphql',
			symbol: 'githubGraphql',
			state: 'returns-verified-blob-text-for-a-valid-batch',
			evidence: 'examples-cases',
			file: 'returns-verified-blob-text-for-a-valid-batch.json'
		},
		[
			{
				name: 'read one tree-attested blob in one GraphQL batch',
				input: { commit: COMMIT, entries: [{ path: PATH, sha, size: entry.size }] },
				output: { requests: calls, blobs: { [PATH]: text } }
			}
		]
	);
});

test('Rejects a blob whose text does not match its Git hash', async () => {
	const original = 'export const value = 1;\n';
	const forged = 'export const value = 2;\n!';
	const sha = gitBlobSha(original);
	const entry = entryOf(sha, bytesOf(forged));
	const failure = await failureOf(
		githubGraphql(optionsWith(respondWith(envelope([blobOf(sha, forged)]), [])), {
			commit: COMMIT,
			entries: [entry]
		})
	);
	expect(failure).toEqual(UNAVAILABLE);
	recordExampleCases(
		{
			unitId: 'collaboration.function.github-graphql',
			symbol: 'githubGraphql',
			state: 'rejects-a-blob-whose-text-does-not-match-its-git-hash',
			evidence: 'examples-cases',
			file: 'rejects-a-blob-whose-text-does-not-match-its-git-hash.json'
		},
		[
			{
				name: 'blob text hashes to a different Git blob than the entry sha',
				input: { commit: COMMIT, entries: [{ path: PATH, sha, size: entry.size }] },
				error: failure
			}
		]
	);
});

test('Rejects an empty batch before calling GitHub', async () => {
	const calls: string[] = [];
	const failure = await failureOf(
		githubGraphql(optionsWith(respondWith(envelope([]), calls)), { commit: COMMIT, entries: [] })
	);
	expect(failure).toEqual(UNAVAILABLE);
	expect(calls).toEqual([]);
	recordExampleCases(
		{
			unitId: 'collaboration.function.github-graphql',
			symbol: 'githubGraphql',
			state: 'rejects-an-empty-batch-before-calling-github',
			evidence: 'examples-cases',
			file: 'rejects-an-empty-batch-before-calling-github.json'
		},
		[
			{
				name: 'batch with zero entries is refused',
				input: { commit: COMMIT, entries: [] },
				error: failure
			}
		]
	);
});

test('Rejects a response from a different repository id', async () => {
	const text = 'export const value = 1;\n';
	const sha = gitBlobSha(text);
	const entry = entryOf(sha, bytesOf(text));
	const calls: string[] = [];
	const failure = await failureOf(
		githubGraphql(optionsWith(respondWith(envelope([blobOf(sha, text)], 99), calls)), {
			commit: COMMIT,
			entries: [entry]
		})
	);
	expect(failure).toEqual(UNAVAILABLE);
	expect(calls).toHaveLength(1);
	recordExampleCases(
		{
			unitId: 'collaboration.function.github-graphql',
			symbol: 'githubGraphql',
			state: 'rejects-a-response-from-a-different-repository-id',
			evidence: 'examples-cases',
			file: 'rejects-a-response-from-a-different-repository-id.json'
		},
		[
			{
				name: 'response databaseId 99 does not match repository id 42',
				input: { commit: COMMIT, entries: [{ path: PATH, sha, size: entry.size }] },
				error: failure
			}
		]
	);
});
