import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { CatalogIndexService } from '../../src/services/CatalogIndexService';
import { CatalogRepository } from '../../src/repositories/CatalogRepository';
import { catalogFixture } from '../support/catalogFixture';

test('a disk catalog survives reopening, is private, and failed replacements leave it readable', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'harness-catalog-'));
	try {
		const { index, snapshots } = catalogFixture();
		const writer = new CatalogIndexService();
		const path = await writer.write(directory, index, snapshots);
		expect((await stat(path)).mode & 0o777).toBe(0o600);
		const conflicting = [...snapshots, snapshots[0]];
		await expect(writer.write(directory, index, conflicting)).rejects.toThrow(/UNIQUE|constraint/i);
		const db = new DatabaseSync(path, { readOnly: true });
		try {
			expect(new CatalogRepository(db, false).entities({ kind: 'model' })).toHaveLength(1);
		} finally {
			db.close();
		}
		expect(await readdir(directory)).toEqual(['catalog.sqlite']);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
