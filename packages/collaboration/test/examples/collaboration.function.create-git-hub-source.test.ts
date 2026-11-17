import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createGitHubSource } from '../../src/utils/git-source-history/create-git-hub-source/createGitHubSource';
import type { Options } from '../../src/utils/git-source-history/create-git-hub-source/createGitHubSource.types';

const unitId = 'collaboration.function.create-git-hub-source';
const symbol = 'createGitHubSource';
const repo = {
	id: 42,
	owner: 'example-org',
	name: 'example-docs',
	private: true,
	installationId: 7
};
const base = `https://api.github.com/repos/${repo.owner}/${repo.name}`;
const commit = 'a'.repeat(40);
const other = 'c'.repeat(40);
const tree = 'b'.repeat(40);
const readme = new TextEncoder().encode('# Example\n');
const script = new TextEncoder().encode('echo ok\n');

function blobSha(bytes: Uint8Array): string {
	return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

const readmeSha = blobSha(readme);
const scriptSha = blobSha(script);
const entries = [
	{ path: 'README.md', sha: readmeSha, type: 'blob', mode: '100644', size: readme.length },
	{ path: 'bin/run.sh', sha: scriptSha, type: 'blob', mode: '100755', size: script.length },
	{ path: 'docs', sha: 'd'.repeat(40), type: 'tree', mode: '040000' }
];

function blobBody(bytes: Uint8Array, sha: string) {
	return {
		sha,
		size: bytes.length,
		encoding: 'base64',
		content: Buffer.from(bytes).toString('base64')
	};
}

/** Fake GitHub: serves the JSON stored under each repository-relative path (query ignored). */
function fakeFetch(routes: Record<string, unknown>) {
	return async (input: RequestInfo | URL) => {
		const path = String(input).slice(base.length).split('?')[0];
		const body = routes[path];
		return new Response(JSON.stringify(body ?? {}), {
			status: body === undefined ? 404 : 200,
			headers: { 'content-type': 'application/json' }
		});
	};
}

function options(routes: Record<string, unknown>): Options {
	return { token: async () => 'example-token', fetch: fakeFetch(routes) };
}

function routes(): Record<string, unknown> {
	return {
		'': { id: repo.id, private: repo.private },
		[`/git/commits/${commit}`]: { sha: commit, tree: { sha: tree } },
		[`/git/trees/${tree}`]: { sha: tree, truncated: false, tree: entries },
		[`/git/blobs/${readmeSha}`]: blobBody(readme, readmeSha),
		[`/git/blobs/${scriptSha}`]: blobBody(script, scriptSha)
	};
}

function meta(state: string) {
	return { unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

test('Resolves immutable commit trees and repository history', async () => {
	const source = createGitHubSource(options(routes()));
	const resolved = await source.resolve(repo, commit);
	const listed = await source.tree(repo, commit);
	expect(resolved).toEqual({ commit, tree });
	expect(listed.map((entry) => entry.path)).toEqual(['README.md', 'bin/run.sh', 'docs']);
	recordExampleCases(meta('resolves-immutable-commit-trees-and-repository-history'), [
		{ name: 'resolve a full commit sha', input: { commit }, output: resolved },
		{
			name: 'list the tree of that commit',
			input: { commit },
			output: listed.map((entry) => ({ path: entry.path, type: entry.type, mode: entry.mode }))
		}
	]);
});

test('Returns verified raw bytes and independent read copies', async () => {
	const source = createGitHubSource(options(routes()));
	const first = await source.raw(repo, { commit, path: 'README.md' });
	first[0] = 0;
	const second = await source.raw(repo, { commit, path: 'README.md' });
	const executable = await source.raw(repo, { commit, path: 'bin/run.sh' });
	expect(new TextDecoder().decode(second)).toBe('# Example\n');
	expect(second).not.toBe(first);
	expect(executable.length).toBe(script.length);
	recordExampleCases(meta('returns-verified-raw-bytes-and-independent-read-copies'), [
		{
			name: 'raw bytes of README.md, mutated copy does not leak',
			input: { commit, path: 'README.md' },
			output: { size: second.length, text: new TextDecoder().decode(second) }
		},
		{
			name: 'raw bytes of executable bin/run.sh',
			input: { commit, path: 'bin/run.sh' },
			output: { size: executable.length }
		}
	]);
});

test('Materializes LFS files and copies cached bytes', async () => {
	const source = createGitHubSource(options(routes()));
	const input = { commit, path: 'bin/run.sh' };
	const bytes = await source.read(repo, input);
	bytes[0] = 0;
	const again = await source.read(repo, input);
	expect(new TextDecoder().decode(again)).toBe('echo ok\n');
	expect(source.releaseBytes).toBeDefined();
	source.releaseBytes?.(repo, input);
	recordExampleCases(meta('materializes-lfs-files-and-copies-cached-bytes'), [
		{
			name: 'materialize non-pointer file, cached copy is independent',
			input,
			output: { size: again.length, text: new TextDecoder().decode(again) }
		}
	]);
});

test('Throws CollaborationInputError on commit mismatch', async () => {
	const mismatched = { ...routes(), [`/git/commits/${commit}`]: { sha: other, tree: { sha: tree } } };
	const source = createGitHubSource(options(mismatched));
	const error = await source.resolve(repo, commit).catch((failure: unknown) => failure);
	expect(error).toMatchObject({ code: 'commit-mismatch', message: 'Collaboration commit-mismatch' });
	recordExampleCases(meta('throws-collaborationinputerror-on-commit-mismatch'), [
		{
			name: 'commit endpoint answers with a different sha',
			input: { commit },
			error: { code: 'commit-mismatch', message: 'Collaboration commit-mismatch' }
		}
	]);
});

test('Throws CollaborationInputError on blob integrity failure', async () => {
	const tampered = { ...routes(), [`/git/blobs/${readmeSha}`]: blobBody(script, readmeSha) };
	const source = createGitHubSource(options(tampered));
	const input = { commit, path: 'README.md' };
	const error = await source.raw(repo, input).catch((failure: unknown) => failure);
	expect(error).toMatchObject({ code: 'blob-integrity', message: 'Collaboration blob-integrity' });
	recordExampleCases(meta('throws-collaborationinputerror-on-blob-integrity-failure'), [
		{
			name: 'blob content does not hash to its recorded sha',
			input,
			error: { code: 'blob-integrity', message: 'Collaboration blob-integrity' }
		}
	]);
});
