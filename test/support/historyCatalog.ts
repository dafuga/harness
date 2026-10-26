import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { expect } from 'vitest';
import { CatalogRepository } from '../../src/repositories/git-source-history/CatalogRepository';

export function assertCatalogRevision(out: string, commit: string) {
	const db = new DatabaseSync(join(out, 'catalog.sqlite'), { readOnly: true });
	try {
		const unit = new CatalogRepository(db, false)
			.entities({ commit })
			.find((unit) => unit.id === 'function.slugify');
		expect(unit?.sourceMeasurements?.length).toBeGreaterThan(0);
		expect(
			unit?.sourceMeasurements?.every((item) => item.testedRevision === commit),
			'catalog measurements retain the selected commit even when its source tree is shared'
		).toBe(true);
	} finally {
		db.close();
	}
}
