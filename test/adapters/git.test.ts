import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';

// Initial method matrix: run/bytes/attempt/exec/isRepository and bounded errors.
const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'harness-git-adapter-'));
	roots.push(root);
	return new GitAdapter(root);
}
test('run returns trimmed text and bytes preserves binary data', async () => {
	const git = await fixture();
	expect(await git.run(['--version'])).toMatch(/^git version /);
	expect(await git.bytes(['hash-object', '--stdin'], { input: 'hello' })).toEqual(
		Buffer.from('b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0\n')
	);
});
test('attempt and exec retain unsuccessful exit information', async () => {
	const git = await fixture();
	expect(await git.attempt(['rev-parse', 'HEAD'])).toBeUndefined();
	expect(await git.exec(['rev-parse', 'HEAD'])).toMatchObject({ code: 128 });
	await expect(git.run(['rev-parse', 'HEAD'])).rejects.toThrow(/failed:/);
});
test('isRepository distinguishes repositories from plain directories', async () => {
	const git = await fixture();
	expect(await git.isRepository()).toBe(false);
	await git.run(['init', '-q']);
	expect(await git.isRepository()).toBe(true);
});
test('exec stops commands that exceed the deadline or combined output limit', async () => {
	const git = await fixture();
	await git.run(['init', '-q']);
	await expect(git.exec(['-c', 'alias.wait=!sleep 2', 'wait'], { timeoutMs: 50 })).rejects.toThrow(
		/timed out/
	);
	await expect(git.exec(['--version'], { maxBuffer: 1 })).rejects.toThrow(/output limit/);
});
