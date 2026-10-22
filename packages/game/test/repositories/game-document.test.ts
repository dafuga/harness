import { expect, test, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import type * as fs from 'node:fs/promises';
import { chmod, mkdtemp, writeFile, readFile, readdir, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GameDocumentRepository } from '../../src/repositories/game-authoring/GameDocumentRepository';
import { exampleDocument } from '../../src/index';
import type { GameDocument } from '../../src/index';

/** The replacement of game.json can be made to fail after its temporary file was written. */
const failing = vi.hoisted(() => ({ rename: false }));
vi.mock('node:fs/promises', async (importOriginal) => {
	const actual = await importOriginal<typeof fs>();
	const rename: typeof actual.rename = (from, to) =>
		failing.rename
			? Promise.reject(Object.assign(new Error('Injected rename failure'), { code: 'EIO' }))
			: actual.rename(from, to);
	return { ...actual, rename };
});

const limit = 1048576;
const onDisk = (document: GameDocument) => JSON.stringify(document, null, '\t') + '\n';
/** The starter game with `count` more checkpoints, each guided by `text`. */
function withGuidance(text: string, count: number): GameDocument {
	const document = exampleDocument();
	const [first] = document.views[0].checkpoints;
	for (let index = 0; index < count; index++)
		document.views[0].checkpoints.push({
			...first,
			id: 'step-' + index,
			requires: [],
			description: text
		});
	return document;
}
async function workspace(text = JSON.stringify(exampleDocument())) {
	const root = await mkdtemp(join(tmpdir(), 'harness-game-'));
	await writeFile(join(root, 'game.json'), text);
	return { root, file: join(root, 'game.json'), repo: new GameDocumentRepository(root) };
}
const entries = (root: string) => readdir(root);

test('graphs roundtrip, stale writes fail, symlinks are refused', async () => {
	const { root, file, repo } = await workspace();
	try {
		const first = await repo.read();
		first.document.views[0].title = 'Edited';
		const saved = await repo.save(first.document, first.revision);
		expect((await repo.read()).document.views[0].title).toBe('Edited');
		const current = await readFile(file, 'utf8');
		await expect(repo.save(first.document, first.revision)).rejects.toThrow('changed');
		expect(await readFile(file, 'utf8')).toBe(current);
		expect(await entries(root)).toEqual(['game.json']);
		expect(saved.revision).not.toBe(first.revision);
		const outside = join(root, 'outside.json');
		await writeFile(outside, await readFile(file));
		await rm(file);
		await symlink(outside, file);
		await expect(repo.read()).rejects.toThrow('regular');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('a valid game well over 64 KiB saves and reopens unchanged, and keeps its file mode', async () => {
	const { root, file, repo } = await workspace();
	try {
		await chmod(file, 0o664);
		const opened = await repo.read(),
			large = withGuidance('A long passage of authored guidance. '.repeat(80), 40);
		expect(Buffer.byteLength(onDisk(large))).toBeGreaterThan(65536 * 2);
		const result = await repo.save(large, opened.revision);
		const reopened = await repo.read();
		expect(reopened).toEqual({ document: large, revision: result.revision });
		expect((await stat(file)).mode & 0o777).toBe(0o664);
		expect(await entries(root)).toEqual(['game.json']);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('the 1 MiB cap counts saved bytes, so every saved game reopens', async () => {
	const { root, file, repo } = await workspace();
	try {
		const opened = await repo.read(),
			original = await readFile(file, 'utf8');
		const fits = withGuidance('界'.repeat(4000), 80),
			over = withGuidance('界'.repeat(4000), 100);
		expect(Buffer.byteLength(onDisk(fits))).toBeLessThanOrEqual(limit);
		expect(onDisk(over).length).toBeLessThanOrEqual(limit);
		expect(Buffer.byteLength(onDisk(over))).toBeGreaterThan(limit);
		await expect(repo.save(over, opened.revision)).rejects.toThrow('exceeds 1MB');
		expect(await readFile(file, 'utf8')).toBe(original);
		expect(await entries(root)).toEqual(['game.json']);
		const result = await repo.save(fits, opened.revision);
		expect(await repo.read()).toEqual({ document: fits, revision: result.revision });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('a failed replacement keeps the original game and leaves no temporary file', async () => {
	const { root, file, repo } = await workspace();
	try {
		await chmod(file, 0o644);
		const opened = await repo.read(),
			original = await readFile(file, 'utf8');
		opened.document.views[0].title = 'Never written';
		failing.rename = true;
		await expect(repo.save(opened.document, opened.revision)).rejects.toThrow(
			'Injected rename failure'
		);
		failing.rename = false;
		expect(await readFile(file, 'utf8')).toBe(original);
		expect((await stat(file)).mode & 0o777).toBe(0o644);
		expect(await entries(root)).toEqual(['game.json']);
		expect((await repo.read()).revision).toBe(opened.revision);
	} finally {
		failing.rename = false;
		await rm(root, { recursive: true, force: true });
	}
});
