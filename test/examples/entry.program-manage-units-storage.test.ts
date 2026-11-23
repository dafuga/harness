import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { specificationStorageReport } from '../../src/cli/program/manageUnitsStorage';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Reports unit and budget storage totals', async () => {
	await withTempDir('manage-units-storage-', async (root) => {
		const units = join(root, 'specification', 'units');
		mkdirSync(join(units, 'nested'), { recursive: true });
		mkdirSync(join(root, 'specification', 'budgets'), { recursive: true });
		writeFileSync(join(units, 'first.json'), '{}');
		writeFileSync(join(units, 'nested', 'second.json'), '{"name":"two"}');
		writeFileSync(join(units, 'notes.txt'), 'ignored');
		writeFileSync(
			join(root, 'specification', 'budgets', 'ledger.ndjson'),
			'{"event":1}\n{"event":2}\n'
		);

		const report = await specificationStorageReport(root);
		const output = {
			units: report.units,
			budgetLedger: report.budgetLedger,
			operatorHeadsUpBytes: report.operatorHeadsUpBytes,
			warnings: report.warnings
		};
		expect(output).toEqual({
			units: { files: 2, bytes: 16 },
			budgetLedger: { bytes: 24, lines: 2 },
			operatorHeadsUpBytes: { units: 16777216, budgetLedger: 2097152 },
			warnings: []
		});
		recordExampleCases(
			{
				unitId: 'entry.program-manage-units-storage',
				symbol: 'specificationStorageReport',
				state: 'reports-unit-and-budget-storage-totals',
				evidence: 'examples-cases',
				file: 'reports-unit-and-budget-storage-totals.json'
			},
			[
				{
					name: 'counts nested JSON files and ledger lines',
					input: { root: '/workspace/project' },
					output
				}
			]
		);
	});
});

test('Throws Error when ledger stream fails', async () => {
	await withTempDir('manage-units-storage-error-', async (root) => {
		const ledger = join(root, 'specification', 'budgets', 'ledger.ndjson');
		mkdirSync(ledger, { recursive: true });
		const report = specificationStorageReport(root);
		await expect(report).rejects.toThrow();
		recordExampleCases(
			{
				unitId: 'entry.program-manage-units-storage',
				symbol: 'specificationStorageReport',
				state: 'throws-error-when-ledger-stream-fails',
				evidence: 'examples-cases',
				file: 'throws-error-when-ledger-stream-fails.json'
			},
			[
				{
					name: 'rejects when ledger is a directory',
					input: { root: '/workspace/project' },
					error: 'Error: ledger stream failed for directory ledger.ndjson'
				}
			]
		);
	});
});
