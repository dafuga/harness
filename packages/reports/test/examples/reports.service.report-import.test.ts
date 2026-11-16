import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ReportImportService } from '../../src/services/reports-media/report-command-service/ReportImportService';

function makeService() {
	const records: Array<{ reportId: string; record: unknown }> = [];
	const repository = {
		record: async (reportId: string, record: unknown) => {
			records.push({ reportId, record });
		}
	};
	return { service: new ReportImportService(repository as never), records };
}

function tempDirectory(prefix: string) {
	return mkdtempSync(join(tmpdir(), `${prefix}-`));
}

test('Imports manual records and resolves evidence paths', async () => {
	const directory = tempDirectory('report-import-manual');
	try {
		const file = join(directory, 'import.json');
		writeFileSync(file, JSON.stringify([
			{ kind: 'evidence', data: { path: 'artifacts/result.json' } },
			{ kind: 'finding', data: { title: 'Missing assertion' } }
		]));
		const { service, records } = makeService();
		const output = await service.ingest('manual', 'report-1', file);
		expect(output).toEqual({ records: 2 });
		expect(records).toHaveLength(2);
		expect(records[0].record).toEqual({ kind: 'evidence', data: { path: join(directory, 'artifacts/result.json') } });
		recordExampleCases(
			{ unitId: 'reports.service.report-import', symbol: 'ingest', state: 'imports-manual-records-and-resolves-evidence-paths', evidence: 'examples-cases', file: 'imports-manual-records-and-resolves-evidence-paths.json' },
			[{ name: 'manual evidence path is relative to the import file', input: { format: 'manual', id: 'report-1', records: [{ kind: 'evidence', data: { path: 'artifacts/result.json' } }, { kind: 'finding', data: { title: 'Missing assertion' } }] }, output: { records: 2, evidencePath: join(directory, 'artifacts/result.json') } }]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Imports command outcomes as checks', async () => {
	const directory = tempDirectory('report-import-command');
	try {
		const file = join(directory, 'command.json');
		writeFileSync(file, JSON.stringify({ exitCode: 1, title: 'Typecheck', command: 'bun run typecheck', output: '1 error', durationMs: 120 }));
		const { service, records } = makeService();
		const output = await service.ingest('command', 'report-2', file);
		expect(output).toEqual({ checks: 1 });
		expect(records[0]).toEqual({ reportId: 'report-2', record: { kind: 'check', data: { id: expect.any(String), title: 'Typecheck', status: 'failed', command: 'bun run typecheck', output: '1 error', durationMs: 120, group: 'Command' } } });
		recordExampleCases(
			{ unitId: 'reports.service.report-import', symbol: 'ingest', state: 'imports-command-outcomes-as-checks', evidence: 'examples-cases', file: 'imports-command-outcomes-as-checks.json' },
			[{ name: 'nonzero exit code becomes a failed check', input: { format: 'command', id: 'report-2', exitCode: 1, title: 'Typecheck', command: 'bun run typecheck', output: '1 error', durationMs: 120 }, output: { checks: 1, status: 'failed', title: 'Typecheck', command: 'bun run typecheck', durationMs: 120 } }]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
