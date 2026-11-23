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
					output: {
						path: '<temporary-directory>/catalog.sqlite',
						mode,
						temporaryDirectoriesRemaining: leftovers.length
					}
				}
			]
		);
	});
});

test('Throws TypeError when directory is not a string', async () => {
	const directory = 42 as unknown as string;
	let error: unknown;
	try {
		await new CatalogIndexService().write(directory, emptyIndex, []);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(TypeError);
	recordExampleCases(
		{
			unitId: 'service.catalog-index',
			symbol: 'CatalogIndexService.write',
			state: 'throws-typeerror-when-directory-is-not-a-string',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-directory-is-not-a-string.json'
		},
		[
			{
				name: 'number directory is rejected by path.join',
				input: { directory, index: emptyIndex, snapshots: [] },
				error: 'TypeError'
			}
		]
	);
});

test('Throws Error when temporary directory cannot be created', async () => {
	await withTempDir('catalog-index-missing-parent-', async (directory) => {
		const missing = join(directory, 'missing');
		let error: unknown;
		try {
			await new CatalogIndexService().write(missing, emptyIndex, []);
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(Error);
		recordExampleCases(
			{
				unitId: 'service.catalog-index',
				symbol: 'CatalogIndexService.write',
				state: 'throws-error-when-temporary-directory-cannot-be-created',
				evidence: 'examples-cases',
				file: 'throws-error-when-temporary-directory-cannot-be-created.json'
			},
			[
				{
					name: 'missing destination directory prevents temporary creation',
					input: { directory: '<missing-directory>', index: emptyIndex, snapshots: [] },
					error: 'Error'
				}
			]
		);
	});
});
