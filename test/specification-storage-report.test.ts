import { mkdir, readFile, truncate, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { specificationStorageReport } from '../scripts/report-specification-storage';
import { renderCheck } from '../src/cli/program/manageUnits';
import { withTempDir } from './support/temporary';

test('reports unit JSON count/bytes and ledger line/byte totals without mutation', async () => {
	await withTempDir('harness-specification-storage-', async (root) => {
		const units = join(root, 'specification/units');
		const budgets = join(root, 'specification/budgets');
		await mkdir(units, { recursive: true });
		await mkdir(budgets, { recursive: true });
		await writeFile(join(units, 'one.json'), '{}\n');
		await writeFile(join(units, 'two.json'), '{"id":"unit"}\n');
		await writeFile(join(units, 'ignored.md'), 'not a unit manifest');
		const ledgerPath = join(budgets, 'ledger.ndjson');
		const ledger = '{"id":"one"}\n{"id":"two"}';
		await writeFile(ledgerPath, ledger);
		const before = await readFile(ledgerPath, 'utf8');
		expect(await specificationStorageReport(root)).toEqual({
			units: { files: 2, bytes: Buffer.byteLength('{}\n{"id":"unit"}\n') },
			budgetLedger: { lines: 2, bytes: Buffer.byteLength(ledger) },
			operatorHeadsUpBytes: { units: 16 * 1024 * 1024, budgetLedger: 2 * 1024 * 1024 },
			warnings: []
		});
		expect(await readFile(ledgerPath, 'utf8')).toBe(before);
	});
});

test('reports threshold crossings as operator heads-ups without blocking the report', async () => {
	await withTempDir('harness-specification-storage-warning-', async (root) => {
		const units = join(root, 'specification/units');
		const ledgerPath = join(root, 'specification/budgets/ledger.ndjson');
		await mkdir(units, { recursive: true });
		await mkdir(join(root, 'specification/budgets'), { recursive: true });
		const largeUnit = join(units, 'large.json');
		await writeFile(largeUnit, '');
		await truncate(largeUnit, 16 * 1024 * 1024);
		await writeFile(ledgerPath, '');
		await truncate(ledgerPath, 2 * 1024 * 1024);
		const report = await specificationStorageReport(root);
		expect(report.warnings).toEqual([
			'Unit JSON store is at or above the 16777216-byte operator heads-up.',
			'Budget ledger is at or above the 2097152-byte operator heads-up.'
		]);
		expect(
			renderCheck({ units: 1, uncertain: 0, errors: [], warnings: report.warnings })
		).toContain('Warning: Budget ledger is at or above the 2097152-byte operator heads-up.');
	});
});
