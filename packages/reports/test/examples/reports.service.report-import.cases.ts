import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ReportImportService } from '../../src/services/reports-media/report-command-service/ReportImportService';

export function makeService() {
	const records: Array<{ reportId: string; record: unknown }> = [];
	const repository = {
		record: async (reportId: string, record: unknown) => {
			records.push({ reportId, record });
		}
	};
	return { service: new ReportImportService(repository as never), records };
}

export function tempDirectory(prefix: string) {
	return mkdtempSync(join(tmpdir(), `${prefix}-`));
}

test('Imports manual records and resolves evidence paths', async () => {
	const directory = tempDirectory('report-import-manual');
	try {
		const file = join(directory, 'import.json');
		writeFileSync(
			file,
			JSON.stringify([
				{ kind: 'evidence', data: { path: 'artifacts/result.json' } },
				{ kind: 'finding', data: { title: 'Missing assertion' } }
			])
		);
		const { service, records } = makeService();
		const output = await service.ingest('manual', 'report-1', file);
		expect(output).toEqual({ records: 2 });
		expect(records).toHaveLength(2);
		expect(records[0].record).toEqual({
			kind: 'evidence',
			data: { path: join(directory, 'artifacts/result.json') }
		});
		recordExampleCases(
			{
				unitId: 'reports.service.report-import',
				symbol: 'ingest',
				state: 'imports-manual-records-and-resolves-evidence-paths',
				evidence: 'examples-cases',
				file: 'imports-manual-records-and-resolves-evidence-paths.json'
			},
			[
				{
					name: 'manual evidence path is relative to the import file',
					input: {
						format: 'manual',
						id: 'report-1',
						records: [
							{ kind: 'evidence', data: { path: 'artifacts/result.json' } },
							{ kind: 'finding', data: { title: 'Missing assertion' } }
						]
					},
					output: { records: 2, evidencePath: join(directory, 'artifacts/result.json') }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
