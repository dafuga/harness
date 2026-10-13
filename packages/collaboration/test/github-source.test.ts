import { expect, test } from 'vitest';
import { createGitHubSource } from '../src/utils/createGitHubSource';
import { sourceRepository } from './githubFixture';
import type { GitHubOptions } from '../src/models/Collaboration.types';
import { digest } from '../src/utils/parseCollaborationInput';
const commit = 'a'.repeat(40),
	tree = 'b'.repeat(40);
async function sourceFixture(bytes = new TextEncoder().encode('historical source')) {
	const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
	const gitBytes = new Uint8Array(header.length + bytes.length);
	gitBytes.set(header);
	gitBytes.set(bytes, header.length);
	const blob = await digest(gitBytes, 'SHA-1');
	const calls: string[] = [];
	const state = {
		truncated: false,
		wrongRef: false,
		corrupt: false,
		calls
	};
	const options: Omit<GitHubOptions, 'repository'> = {
		async token(input) {
			expect(input).toMatchObject({ permissions: { contents: 'read' } });
			return 'secret';
		},
		fetch: async (url) => {
			calls.push(String(url));
			const path = new URL(String(url)).pathname;
			const result = (data: unknown) => new Response(JSON.stringify(data));
			if (path.endsWith('/source')) return result({ id: 202, private: true });
			if (path.includes('/git/ref/'))
				return result({
					ref: state.wrongRef ? 'refs/heads/feature/comments-extra' : 'refs/heads/feature/comments',
					object: { sha: commit }
				});
			if (path.includes('/git/commits/')) return result({ sha: commit, tree: { sha: tree } });
			if (path.includes('/git/trees/'))
				return result({
					sha: tree,
					truncated: state.truncated,
					tree: [{ path: 'src/old.ts', sha: blob, mode: '100644', type: 'blob' }]
				});
			return result({
				sha: blob,
				size: bytes.length,
				encoding: 'base64',
				content: btoa(state.corrupt ? 'wrong' : new TextDecoder().decode(bytes))
			});
		}
	};
	return { state, adapter: () => createGitHubSource(options) };
}
test('source reads exact commits, reject prefix refs and truncated trees, verify content bytes', async () => {
	const fixture = await sourceFixture();
	expect(await fixture.adapter().resolve(sourceRepository, 'refs/heads/feature/comments')).toEqual({
		commit,
		tree
	});
	expect(
		new TextDecoder().decode(
			await fixture.adapter().read(sourceRepository, { commit, path: 'src/old.ts' })
		)
	).toBe('historical source');
	fixture.state.wrongRef = true;
	await expect(
		fixture.adapter().resolve(sourceRepository, 'refs/heads/feature/comments')
	).rejects.toMatchObject({ code: 'ref-mismatch' });
	fixture.state.truncated = true;
	await expect(fixture.adapter().tree(sourceRepository, commit)).rejects.toMatchObject({
		code: 'truncated-tree'
	});
	fixture.state.truncated = false;
	fixture.state.corrupt = true;
	await expect(
		fixture.adapter().read(sourceRepository, { commit, path: 'src/old.ts' })
	).rejects.toMatchObject({ code: 'blob-integrity' });
	await expect(
		fixture.adapter().read(sourceRepository, { commit, path: '../secret' })
	).rejects.toMatchObject({ code: 'invalid-path' });
});

test('request-local immutable reads share trees and bytes but never share repository authority', async () => {
	const fixture = await sourceFixture();
	const adapter = fixture.adapter();
	const input = { commit, path: 'src/old.ts' };
	const results = await Promise.all([
		adapter.read(sourceRepository, input),
		adapter.read(sourceRepository, input)
	]);
	results[0][0] = 0;
	expect(new TextDecoder().decode(await adapter.read(sourceRepository, input))).toBe(
		'historical source'
	);
	expect(fixture.state.calls.filter((url) => url.includes('/git/trees/'))).toHaveLength(1);
	expect(fixture.state.calls.filter((url) => url.includes('/git/blobs/'))).toHaveLength(1);
	await expect(adapter.read({ ...sourceRepository, id: 303 }, input)).rejects.toMatchObject({
		code: 'repository-denied'
	});
	fixture.state.wrongRef = true;
	await expect(
		adapter.resolve(sourceRepository, 'refs/heads/feature/comments')
	).rejects.toMatchObject({ code: 'ref-mismatch' });
});

test('failed immutable reads are evicted and caller mutation cannot poison commit provenance', async () => {
	const fixture = await sourceFixture(),
		adapter = fixture.adapter();
	const resolved = await adapter.resolve(sourceRepository, commit);
	resolved.tree = 'f'.repeat(40);
	expect(await adapter.resolve(sourceRepository, commit)).toEqual({ commit, tree });
	fixture.state.corrupt = true;
	await expect(
		adapter.read(sourceRepository, { commit, path: 'src/old.ts' })
	).rejects.toMatchObject({ code: 'blob-integrity' });
	fixture.state.corrupt = false;
	expect(
		new TextDecoder().decode(await adapter.read(sourceRepository, { commit, path: 'src/old.ts' }))
	).toBe('historical source');
	expect(fixture.state.calls.filter((url) => url.includes('/git/blobs/'))).toHaveLength(2);
});

test('raw reads attest exact LFS pointers without downloads and share immutable Git fetches', async () => {
	const pointer = new TextEncoder().encode(
		`version https://git-lfs.github.com/spec/v1\noid sha256:${'c'.repeat(64)}\nsize 27\n`
	);
	const fixture = await sourceFixture(pointer),
		adapter = fixture.adapter();
	const input = { commit, path: 'src/old.ts' };
	const actual = await adapter.raw(sourceRepository, input);
	expect(actual).toEqual(pointer);
	actual[0] = 0;
	expect(await adapter.raw(sourceRepository, input)).toEqual(pointer);
	expect(fixture.state.calls.filter((url) => url.includes('/git/blobs/'))).toHaveLength(1);
	expect(fixture.state.calls.some((url) => url.includes('/objects/batch'))).toBe(false);
	await expect(adapter.read(sourceRepository, input)).rejects.toMatchObject({
		code: 'lfs-unavailable'
	});
	expect(fixture.state.calls.filter((url) => url.includes('/git/blobs/'))).toHaveLength(1);
	fixture.state.corrupt = true;
	await expect(fixture.adapter().raw(sourceRepository, input)).rejects.toMatchObject({
		code: 'blob-integrity'
	});
});

for (const method of ['raw', 'read'] as const) {
	test(`sequential readers release ${method} byte memo while preserving immutable tree facts`, async () => {
		const fixture = await sourceFixture(),
			adapter = fixture.adapter();
		const input = { commit, path: 'src/old.ts' };
		await adapter[method](sourceRepository, input);
		adapter.releaseBytes!(sourceRepository, input);
		fixture.state.corrupt = true;
		await expect(adapter[method](sourceRepository, input)).rejects.toMatchObject({
			code: 'blob-integrity'
		});
		expect(fixture.state.calls.filter((url) => url.includes('/git/blobs/'))).toHaveLength(2);
		expect(fixture.state.calls.filter((url) => url.includes('/git/trees/'))).toHaveLength(1);
	});
}
