import { expect, test } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GameDocumentRepository } from '../../src/repositories/GameDocumentRepository';
import { exampleDocument } from '../../src/index';

test('graphs roundtrip, stale writes fail, symlinks are refused', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-game-'));
	try {
		const file = join(root, 'game.json');
		await writeFile(file, JSON.stringify(exampleDocument()));
		const repo = new GameDocumentRepository(root);
		const first = await repo.read();
		first.document.views[0].title = 'Edited';
		const saved = await repo.save(first.document, first.revision);
		expect((await repo.read()).document.views[0].title).toBe('Edited');
		await expect(repo.save(first.document, first.revision)).rejects.toThrow('changed');
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
