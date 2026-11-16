import { test } from 'vitest';
import { createGitHubSource } from '../../src/utils/git-source-history/create-git-hub-source/createGitHubSource';
import type { Options } from '../../src/utils/git-source-history/create-git-hub-source/createGitHubSource.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

const repository = {
	id: 202,
	owner: 'acme-labs',
	name: 'web-app',
	private: true,
	installationId: 7
};
const commit = '0123456789abcdef0123456789abcdef01234567';
const tree = '1'.repeat(40);
const lfsOid = '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03';
const lfsBlobSha = 'fa61e1ef71c9908c0926776a4aa3504b3a27f159';
const base = `GET /repos/${repository.owner}/${repository.name}`;

const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
const commitResponse = (sha: string, treeSha: string) => ({ sha, tree: { sha: treeSha } });
const treeResponse = (sha: string, path: string, blobSha: string, size: number) => ({
	sha,
	truncated: false,
	tree: [{ path, sha: blobSha, type: 'blob', mode: '100644', size }]
});
const blobResponse = (sha: string, content: string) => ({
	sha,
	size: new TextEncoder().encode(content).length,
	encoding: 'base64',
	content: btoa(content)
});
const lfsBatchResponse = (oid: string, size: number) =>
	response({
		objects: [
			{
				oid,
				size,
				actions: { download: { href: 'https://objects.githubusercontent.com/artifacts/hello' } }
			}
		]
	});

function fixtureOptions(
	routes: Record<string, unknown>,
	fallback?: (url: URL, init?: RequestInit) => Response
) {
	const requests: string[] = [];
	const options: Options = {
		token: async () => 'fixture-token',
		fetch: async (input, init) => {
			const url = new URL(String(input));
			const method = init?.method ?? 'GET';
			const key = `${method} ${url.pathname}${url.search}`,
				relativeKey = `${method} ${url.pathname.replace(`/repos/${repository.owner}/${repository.name}`, '')}${url.search}`;
			requests.push(`${method} ${url.hostname}${url.pathname}${url.search}`);
			if (key in routes) return response(routes[key]);
			if (relativeKey in routes) return response(routes[relativeKey]);
			if (fallback) return fallback(url, init);
			throw new Error(`Unexpected fixture request: ${key}`);
		}
	};
	return { options, requests };
}

const evidence = (state: string) => ({
	unitId: 'collaboration.function.create-git-hub-source',
	symbol: 'createGitHubSource',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

async function failure(action: () => Promise<unknown>) {
	try {
		await action();
	} catch (error) {
		if (error instanceof Error && 'code' in error)
			return { code: String(error.code), message: error.message };
		throw error;
	}
	return null;
}
test('resolves immutable commit trees and repository history', async () => {
	const path = 'docs/overview.md';
	const parent = '9'.repeat(40);
	const { options, requests } = fixtureOptions({
		[base]: { id: repository.id, private: true },
		[`GET /git/commits/${commit}`]: {
			...commitResponse(commit, tree),
			parents: [{ sha: parent }],
			message: 'Document source reads\n\nDescribe immutable history.',
			author: { name: 'Fixture Author', date: '2026-11-15T08:00:00.000Z' },
			committer: { name: 'Fixture Committer', date: '2026-11-15T09:00:00.000Z' }
		},
		[`GET /git/trees/${tree}?recursive=1`]: treeResponse(tree, path, '2'.repeat(40), 6),
		'GET /branches?per_page=100&page=1': [{ name: 'main', commit: { sha: commit } }]
	});
	const source = createGitHubSource(options);
	const first = await source.resolve(repository, commit);
	first.commit = 'f'.repeat(40);
	const resolved = await source.resolve(repository, commit);
	const firstTree = await source.tree(repository, commit);
	firstTree[0].path = 'changed.md';
	const entries = await source.tree(repository, commit);
	const facts = await source.facts!(repository, commit);
	const branches = await source.branches(repository);
	const input = { repository, ref: commit };
	const output = {
		resolved,
		entries: entries.map(({ path: itemPath, type, mode }) => ({ path: itemPath, type, mode })),
		facts,
		branches
	};
	recordExampleCases(evidence('resolves-immutable-commit-trees-and-repository-history'), [
		{ name: 'resolve and list a tree, then read commit facts and branch history', input, output }
	]);
	expect(resolved).toEqual({ commit, tree });
	expect(entries[0].path).toBe(path);
	expect(facts).toMatchObject({ subject: 'Document source reads', parents: [parent] });
	expect(branches).toEqual([{ name: 'main', tip: commit }]);
	expect(requests.filter((item) => item.includes('/git/commits/'))).toHaveLength(2);
	expect(requests.filter((item) => item.includes('/git/trees/'))).toHaveLength(1);
});

test('returns verified raw bytes and independent read copies', async () => {
	const goodSha = 'ce013625030ba8dba906f756967f9e9ca394464a';
	const expected = new TextEncoder().encode('hello\n');
	const routes = {
		[base]: { id: repository.id, private: true },
		[`GET /git/commits/${commit}`]: commitResponse(commit, tree),
		[`GET /git/trees/${tree}?recursive=1`]: treeResponse(tree, 'docs/readme.md', goodSha, 6)
	};
	const { options, requests } = fixtureOptions(routes, (url) => {
		if (!url.pathname.endsWith(`/git/blobs/${goodSha}`))
			throw new Error(`Unexpected fixture path: ${url.pathname}`);
		return response(blobResponse(goodSha, 'hello\n'));
	});
	const { options: corruptOptions } = fixtureOptions(routes, (url) => {
		if (!url.pathname.endsWith(`/git/blobs/${goodSha}`))
			throw new Error(`Unexpected fixture path: ${url.pathname}`);
		return response(blobResponse('5'.repeat(40), 'hello\n'));
	});
	const source = createGitHubSource(options);
	const corruptSource = createGitHubSource(corruptOptions);
	const input = { repository, commit, path: 'docs/readme.md' };
	const raw = await source.raw(repository, input);
	raw[0] = 0;
	const rawAgain = await source.raw(repository, input);
	const materialized = await source.read(repository, input);
	materialized[0] = 0;
	const readAgain = await source.read(repository, input);
	const mismatch = await failure(() => corruptSource.raw(repository, input));
	recordExampleCases(evidence('returns-verified-raw-bytes-and-independent-read-copies'), [
		{
			name: 'valid Git blob bytes are copied for raw and materialized reads',
			input,
			output: {
				raw: new TextDecoder().decode(rawAgain),
				read: new TextDecoder().decode(readAgain),
				copyIsolated: rawAgain !== readAgain
			}
		},
		{
			name: 'GitHub blob SHA that differs from the tree entry is refused',
			input,
			error: mismatch
		}
	]);
	expect(rawAgain).toEqual(expected);
	expect(readAgain).toEqual(expected);
	expect(mismatch).toEqual({ code: 'blob-integrity', message: 'Collaboration blob-integrity' });
	expect(requests.filter((item) => item.includes('/git/blobs/'))).toHaveLength(1);
});

test('materializes LFS files and copies cached bytes', async () => {
	const path = 'assets/diagram.bin';
	const file = new TextEncoder().encode('hello\n');
	const pointerText = `version https://git-lfs.github.com/spec/v1\noid sha256:${lfsOid}\nsize ${file.length}\n`;
	const pointerBytes = new TextEncoder().encode(pointerText);
	const { options, requests } = fixtureOptions(
		{
			[base]: { id: repository.id, private: true },
			[`GET /git/commits/${commit}`]: commitResponse(commit, tree),
			[`GET /git/trees/${tree}?recursive=1`]: treeResponse(
				tree,
				path,
				lfsBlobSha,
				pointerBytes.length
			),
			[`GET /git/blobs/${lfsBlobSha}`]: blobResponse(lfsBlobSha, pointerText)
		},
		(url, init) => {
			if (url.pathname.endsWith('/objects/batch')) return lfsBatchResponse(lfsOid, file.length);
			if (url.hostname === 'objects.githubusercontent.com') return new Response('hello\n');
			throw new Error(`Unexpected fixture request: ${init?.method ?? 'GET'} ${url.href}`);
		}
	);
	const source = createGitHubSource(options);
	const input = { repository, commit, path };
	const first = await source.read(repository, { commit, path });
	first[0] = 0;
	const cached = await source.read(repository, { commit, path });
	const output = {
		materialized: new TextDecoder().decode(cached),
		copyIsolated: first !== cached
	};
	recordExampleCases(evidence('materializes-lfs-files-and-copies-cached-bytes'), [
		{
			name: 'valid LFS pointer is materialized once and each read returns a copy',
			input,
			output
		}
	]);
	expect(cached).toEqual(file);
	expect(first).not.toBe(cached);
	expect(requests.filter((item) => item.includes('/objects/batch'))).toHaveLength(1);
	expect(requests.filter((item) => item.includes('objects.githubusercontent.com'))).toHaveLength(1);
});
