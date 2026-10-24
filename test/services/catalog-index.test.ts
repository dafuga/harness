import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { CatalogIndexService } from '../../src/services/git-source-history/CatalogIndexService';
import { CatalogRepository } from '../../src/repositories/git-source-history/CatalogRepository';
import { catalogFixture } from '../support/catalogFixture';

test.each([false, true])(
	'a disk catalog survives reopening and failed replacements (repeated edges: %s)',
	async (repeated) => {
		const directory = await mkdtemp(join(tmpdir(), 'harness-catalog-'));
		try {
			const { index, snapshots } = catalogFixture();
			const service = snapshots.at(-1)!.registry.units.find((unit) => unit.id === 'service.posts')!;
			const imported = service.dependencies[0];
			service.dependencies.push({ ...imported, via: 'contract' });
			if (repeated) service.dependencies.push({ ...imported, origin: 'derived' });
			const original = structuredClone(service.dependencies);
			const writer = new CatalogIndexService();
			const path = await writer.write(directory, index, snapshots);
			expect((await stat(path)).mode & 0o777).toBe(0o600);
			const conflicting = [...snapshots, snapshots[0]];
			await expect(writer.write(directory, index, conflicting)).rejects.toThrow(
				/UNIQUE|constraint/i
			);
			const db = new DatabaseSync(path, { readOnly: true });
			try {
				const repository = new CatalogRepository(db, false);
				expect(repository.entities({ kind: 'model' })).toHaveLength(1);
				expect(repository.dependencies('service.posts')).toEqual([
					{ unit: 'model.post', via: 'contract' },
					{ unit: 'model.post', via: 'import' }
				]);
				expect(repository.consumers('model.post')).toEqual([
					{ unit: 'service.posts', via: 'contract' },
					{ unit: 'service.posts', via: 'import' }
				]);
				expect(repository.entities({ kind: 'service' })[0].dependencies).toEqual(original);
				expect(service.dependencies).toEqual(original);
			} finally {
				db.close();
			}
			expect(await readdir(directory)).toEqual(['catalog.sqlite']);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	}
);
