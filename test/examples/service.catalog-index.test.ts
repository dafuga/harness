import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { CatalogIndexService } from '../../src/services/git-source-history/CatalogIndexService';
import type { CatalogSnapshot } from '../../src/services/git-source-history/CatalogWriteService';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const emptyIndex = {
	schemaVersion: 1 as const,
	refs: { evidence: null, notes: null },
	branches: [],
	revisions: [],
	units: [],
	benchmarks: [],
	profiles: [],
	legacy: [],
	truncated: false,
	problems: []
};

test('Writes a replacement catalog database', async () => {
	await withTempDir('catalog-index-write-', async (directory) => {
		const snapshots: CatalogSnapshot[] = [];
		const path = await new CatalogIndexService().write(directory, emptyIndex, snapshots);
		const catalog = join(directory, 'catalog.sqlite');
		const mode = statSync(catalog).mode & 0o777;
		const leftovers = readdirSync(directory).filter((entry) => entry.startsWith('.catalog-'));

		expect(path).toBe(catalog);
		expect(mode).toBe(0o600);
		expect(leftovers).toEqual([]);
		recordExampleCases(
			{
				unitId: 'service.catalog-index',
				symbol: 'CatalogIndexService.write',
				state: 'writes-a-replacement-catalog-database',
				evidence: 'examples-cases',
				file: 'writes-a-replacement-catalog-database.json'
			},
			[
				{
					name: 'empty history index and snapshots produce the destination catalog',
					input: { directory: '<temporary-directory>', index: emptyIndex, snapshots },
					output: { path: '<temporary-directory>/catalog.sqlite', mode, temporaryDirectoriesRemaining: leftovers.length }
				}
			]
		);
	});
});
