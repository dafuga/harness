import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
type Files = Map<string, { text: string; bytes: Buffer; oid: string }>;
type State = { mode: string; cancelled: number };
import { createGitHubSource } from '../src/utils/create-git-hub-source/createGitHubSource';
import { sourceRepository } from './githubFixture';
const commit = 'a'.repeat(40),
	tree = 'b'.repeat(40);
function fixture() {
	const paths = Array.from({ length: 130 }, (_, i) => `specification/units/${i}-é "quoted".json`);
	const files = new Map(
		paths.map((path) => {
			const text = JSON.stringify({ path, label: 'Café 🍵' }),
				bytes = Buffer.from(text);
			const oid = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
			return [path, { text, bytes, oid }];
		})
	);
	const calls: Array<{ url: string; init?: RequestInit }> = [];
	const state = { mode: 'valid', cancelled: 0 };
	const source = createGitHubSource({
		token: async (scope) => {
			expect(scope).toEqual({
				installationId: sourceRepository.installationId,
				repositoryIds: [sourceRepository.id],
				permissions: { contents: 'read' }
			});
			return 'fixture-secret';
		},
		fetch: async (input, init) => {
			const url = String(input);
			calls.push({ url, init });
			if (url.endsWith('/source')) return Response.json({ id: sourceRepository.id, private: true });
			if (url.includes('/git/commits/')) return Response.json({ sha: commit, tree: { sha: tree } });
			if (url.includes('/git/trees/'))
				return Response.json({
					sha: tree,
					truncated: false,
					tree: [...files].map(([path, value]) => ({
						path,
						sha: value.oid,
						type: 'blob',
						mode: '100644',
						size: value.bytes.length
					}))
				});
			if (url !== 'https://api.github.com/graphql') throw Error('Unexpected endpoint');
			return graphResponse(state, files, JSON.parse(String(init?.body)).variables);
		}
	});
	return { source, paths, files, calls, state };
}
test('130 UTF8 metadata files use three variable-only GraphQL batches and share defensive raw/read caches', async () => {
	const f = fixture();
	const result = await f.source.rawMany!(sourceRepository, { commit, paths: f.paths });
	expect(result.size).toBe(130);
	const graph = f.calls.filter((call) => call.url.endsWith('/graphql'));
	expect(graph).toHaveLength(3);
	expect(
		graph.map((call) => Object.keys(JSON.parse(String(call.init?.body)).variables).length - 2)
	).toEqual([64, 64, 2]);
	for (const call of graph) {
		const body = JSON.parse(String(call.init?.body));
		expect(call.init?.redirect).toBe('manual');
		expect(body.query).not.toContain(f.paths[0]);
		expect(body.variables.owner).toBe(sourceRepository.owner);
		expect(body.variables.name).toBe(sourceRepository.name);
	}
	const path = f.paths[0],
		expected = f.files.get(path)!.bytes;
	expect(result.get(path)).toEqual(new Uint8Array(expected));
	result.get(path)![0] = 0;
	expect(await f.source.raw(sourceRepository, { commit, path })).toEqual(new Uint8Array(expected));
	expect(await f.source.read(sourceRepository, { commit, path })).toEqual(new Uint8Array(expected));
	expect((await f.source.rawMany!(sourceRepository, { commit, paths: [path] })).get(path)).toEqual(
		new Uint8Array(expected)
	);
	expect(f.calls.filter((call) => call.url.endsWith('/graphql'))).toHaveLength(3);
	expect(f.calls.some((call) => call.url.includes('/git/blobs/'))).toBe(false);
});
test.each([
	'foreign',
	'redirect',
	'malformed',
	'errors',
	'missing',
	'text',
	'oid',
	'isBinary',
	'isTruncated',
	'oversized'
])('rawMany rejects %s and retries after failure without poisoning cache', async (mode) => {
	const f = fixture();
	f.state.mode = mode;
	await expect(
		f.source.rawMany!(sourceRepository, { commit, paths: [f.paths[0]] })
	).rejects.toThrow();
	expect(f.calls.some((call) => call.url.includes('untrusted.invalid'))).toBe(false);
	if (['redirect', 'oversized'].includes(mode)) expect(f.state.cancelled).toBe(1);
	f.state.mode = 'valid';
	expect((await f.source.rawMany!(sourceRepository, { commit, paths: [f.paths[0]] })).size).toBe(1);
});
test('rawMany rejects paths outside the exact tree and foreign repository before GraphQL', async () => {
	const f = fixture();
	await expect(
		f.source.rawMany!(sourceRepository, { commit, paths: ['outside.json'] })
	).rejects.toThrow();
	await expect(
		f.source.rawMany!({ ...sourceRepository, id: 999 }, { commit, paths: f.paths })
	).rejects.toThrow();
	expect(f.calls.some((call) => call.url.endsWith('/graphql'))).toBe(false);
});

function graphResponse(state: State, files: Files, variables: Record<string, unknown>) {
	const repository: Record<string, unknown> = {
		databaseId: state.mode === 'foreign' ? 999 : sourceRepository.id
	};
	for (const [key, value] of Object.entries(variables)) {
		if (!key.startsWith('p')) continue;
		const file = files.get(String(value).slice(41))!;
		repository['b' + key.slice(1)] = {
			__typename: 'Blob',
			oid: file.oid,
			text: file.text,
			isBinary: false,
			isTruncated: false,
			byteSize: file.bytes.length
		};
	}
	const error = errorResponse(state, repository);
	if (error) return error;
	if (state.mode === 'missing') repository.b0 = null;
	if (['text', 'oid', 'isBinary', 'isTruncated'].includes(state.mode))
		Object.assign(repository.b0 as object, {
			[state.mode]: (
				{ text: 'tampered', oid: 'c'.repeat(40), isBinary: true, isTruncated: true } as Record<
					string,
					unknown
				>
			)[state.mode]
		});
	return Response.json({ data: { repository } });
}

function errorResponse(state: State, repository: Record<string, unknown>): Response | undefined {
	if (state.mode === 'redirect')
		return new Response(
			new ReadableStream({
				cancel() {
					state.cancelled++;
				}
			}),
			{ status: 307, headers: { location: 'https://untrusted.invalid/secret' } }
		);
	if (state.mode === 'malformed') return new Response('private invalid JSON');
	if (state.mode === 'errors')
		return Response.json({ data: { repository }, errors: [{ message: 'private detail' }] });
	if (state.mode === 'oversized')
		return new Response(
			new ReadableStream({
				pull(controller) {
					controller.enqueue(new Uint8Array(1024 * 1024));
				},
				cancel() {
					state.cancelled++;
				}
			})
		);
	return undefined;
}
