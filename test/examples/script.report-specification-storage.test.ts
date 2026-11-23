import type { ExampleCase } from './script.report-specification-storage.test.types';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { specificationStorageReport } from '../../scripts/report-specification-storage';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const unitsHeadsUpBytes = 16777216;
const ledgerHeadsUpBytes = 2097152;
const ledgerPath = 'specification/budgets/ledger.ndjson';

function recordCases(state: string, cases: ExampleCase[]): void {
	recordExampleCases(
		{
			unitId: 'script.report-specification-storage',
			symbol: 'specificationStorageReport',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

async function writeProjectFile(
	root: string,
	relativePath: string,
	content: string | Buffer
): Promise<void> {
	const target = join(root, relativePath);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, content);
}

test('Reports unit and ledger sizes below the heads-up levels', async () => {
	const unitA = '{"id":"a"}\n';
	const unitB = '{"id":"b","name":"nested"}\n';
	const ledger = '{"unit":"a"}\n{"unit":"b"}\n';
	const report = await withTempDir('report-spec-storage-', async (root) => {
		await writeProjectFile(root, 'specification/units/a.json', unitA);
		await writeProjectFile(root, 'specification/units/nested/b.json', unitB);
		await writeProjectFile(root, 'specification/units/notes.txt', 'ignored');
		await writeProjectFile(root, ledgerPath, ledger);
		await symlink(
			join(root, 'specification/units/a.json'),
			join(root, 'specification/units/link.json')
		);
		return specificationStorageReport(root);
	});
	const unitBytes = Buffer.byteLength(unitA) + Buffer.byteLength(unitB);
	expect(report.units).toEqual({ files: 2, bytes: unitBytes });
	expect(report.budgetLedger).toEqual({ bytes: Buffer.byteLength(ledger), lines: 2 });
	expect(report.operatorHeadsUpBytes).toEqual({
		units: unitsHeadsUpBytes,
		budgetLedger: ledgerHeadsUpBytes
	});
	expect(report.warnings).toEqual([]);

	recordCases('reports-unit-and-ledger-sizes-below-the-heads-up-levels', [
		{
			name: 'two unit json files, a symlink, a text file and a ledger',
			input: {
				units: ['a.json', 'nested/b.json', 'link.json (symlink, skipped)', 'notes.txt'],
				ledger: '2 ndjson lines'
			},
			output: report
		}
	]);
});

test('Warns when the budget ledger reaches the heads-up size', async () => {
	const ledgerBytes = Buffer.alloc(ledgerHeadsUpBytes, '\n');
	const report = await withTempDir('report-spec-storage-', async (root) => {
		await writeProjectFile(root, ledgerPath, ledgerBytes);
		return specificationStorageReport(root);
	});
	expect(report.budgetLedger.bytes).toBe(ledgerHeadsUpBytes);
	expect(report.warnings).toEqual([
		'Budget ledger is at or above the 2097152-byte operator heads-up.'
	]);

	recordCases('warns-when-the-budget-ledger-reaches-the-heads-up-size', [
		{
			name: 'ledger exactly at the 2097152-byte heads-up level',
			input: { ledgerBytes: ledgerHeadsUpBytes },
			output: report
		}
	]);
});

test('Reports zero for missing unit and ledger paths', async () => {
	const report = await withTempDir('report-spec-storage-', (root) =>
		specificationStorageReport(root)
	);
	expect(report.units).toEqual({ files: 0, bytes: 0 });
	expect(report.budgetLedger).toEqual({ bytes: 0, lines: 0 });
	expect(report.warnings).toEqual([]);

	recordCases('reports-zero-for-missing-unit-and-ledger-paths', [
		{
			name: 'empty project folder with no specification files',
			input: { root: 'empty temporary folder' },
			output: report
		}
	]);
});
