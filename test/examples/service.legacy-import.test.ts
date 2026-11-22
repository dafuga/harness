import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { LegacyImportService } from '../../src/cli/program/legacy-import-service/LegacyImportService';
import type { LegacyImport } from '../../src/cli/program/legacy-import-service/LegacyImportService.types';

test('Imports nothing from an empty legacy report store', async () => {
	await withTempRepo(async (repository) => {
		await withTempDir('legacy-import-empty-store-', async (store) => {
			const service = new LegacyImportService(repository.root);
			const result: LegacyImport = await service.import(store);

			expect(result).toEqual({ imported: [], skipped: [] });
			expect(result.imported).toHaveLength(0);
			expect(result.skipped).toHaveLength(0);
			recordExampleCases(
				{
					unitId: 'service.legacy-import',
					symbol: 'import',
					state: 'imports-nothing-from-an-empty-legacy-report-store',
					evidence: 'examples-cases',
					file: 'imports-nothing-from-an-empty-legacy-report-store.json'
				},
				[
					{
						name: 'empty report store yields empty imported and skipped lists',
						input: { store: 'empty temporary directory' },
						output: result
					}
				]
			);
		});
	});
});
