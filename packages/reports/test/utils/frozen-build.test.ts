import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { frozenBuild } from '../../src/utils/frozenBuild';

const made: string[] = [];
/** A small stand-in for a compiled build: an entry and a file it would load later. */
function build(): string {
	const root = mkdtempSync(join(tmpdir(), 'frozen-build-'));
	made.push(root);
	mkdirSync(join(root, 'build/server'), { recursive: true });
	writeFileSync(join(root, 'build/index.js'), 'export const entry = 1;\n');
	writeFileSync(join(root, 'build/server/chunk.js'), 'export const later = 2;\n');
	return root;
}
afterEach(() => {
	for (const root of made.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('the copy is the same build, and it stays when the directory it came from is rebuilt', async () => {
	const root = build();
	const frozen = await frozenBuild(join(root, 'build'), join(root, 'run/build'));
	expect(frozen).toEqual({
		build: join(root, 'run/build'),
		buildId: expect.stringMatching(/^[0-9a-f]{64}$/),
		files: 2
	});
	rmSync(join(root, 'build/server'), { recursive: true });
	expect(readFileSync(join(frozen.build, 'server/chunk.js'), 'utf8')).toBe(
		'export const later = 2;\n'
	);
	// Another build of other files is another identity.
	writeFileSync(join(root, 'build/index.js'), 'export const entry = 3;\n');
	const next = await frozenBuild(join(root, 'build'), join(root, 'next/build'));
	expect(next.buildId).not.toBe(frozen.buildId);
});

test('a directory without a build, or one that changes while it is copied, is refused by name', async () => {
	const root = build();
	await expect(frozenBuild(join(root, 'absent'), join(root, 'run/build'))).rejects.toThrow(
		'holds no build'
	);
	// As when another build writes into the directory while this run is still copying it.
	const inside = join(root, 'run/build');
	const overtaken = async (from: string, to: string) => {
		cpSync(from, to, { recursive: true });
		writeFileSync(join(from, 'server/chunk.js'), 'export const later = "rebuilt";\n');
	};
	await expect(frozenBuild(join(root, 'build'), inside, overtaken)).rejects.toThrow(
		/changed while this run was copying it \([0-9a-f]{12}, then [0-9a-f]{12}\): another build is running in this checkout/
	);
	expect(existsSync(inside)).toBe(false);
});
