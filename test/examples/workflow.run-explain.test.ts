import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	explainAdd,
	explainReport,
	explainedRange,
	listed
} from '../../src/workflows/development-tooling/runExplain';
import { withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';
import {
	initialize,
	writeFile,
	sourcePath,
	unitId,
	recordExamples,
	reasonInput,
	behavior,
	simplification,
	performance,
	commit
} from './workflow.run-explain.fixtures';

test('Reports missing reasons for changed source', async () => {
	await withTempRepo(async (repo) => {
		initialize(repo);
		writeFile(
			repo.root,
			sourcePath,
			'export function quote(amount: number) { return amount + 2; }\n'
		);
		const input = { root: repo.root, base: 'HEAD' };
		const report = await explainReport(input);
		const required = report.required.map(({ from: _from, to: _to, ...status }) => status);
		expect(required).toEqual([
			{
				unit: unitId,
				symbol: 'quote',
				file: sourcePath,
				change: 'modified',
				state: 'missing'
			}
		]);
		expect(report.failures).toEqual([
			`${unitId}: quote in ${sourcePath} was modified without a reason`
		]);
		expect(report.writing).toEqual(2);
		recordExamples('explainReport', 'reports-missing-reasons-for-changed-source', [
			{
				name: 'Reports an unrecorded function change under writing version two',
				input: { root: '<temporary Git repository>', base: input.base },
				output: {
					required,
					entries: report.entries,
					overlong: report.overlong,
					failures: report.failures,
					root: '<temporary Git repository>',
					writing: report.writing
				}
			}
		]);
	});
});

test('Projects required statuses without fingerprints', () => {
	const report: Parameters<typeof listed>[0] = {
		required: [
			{
				unit: unitId,
				symbol: 'quote',
				file: sourcePath,
				change: 'modified',
				from: 'a'.repeat(64),
				to: 'b'.repeat(64),
				state: 'missing'
			}
		],
		entries: [],
		overlong: [],
		failures: [`${unitId}: quote in ${sourcePath} was modified without a reason`]
	};
	const rows = listed(report);
	expect(rows).toEqual([
		{ unit: unitId, symbol: 'quote', file: sourcePath, change: 'modified', state: 'missing' }
	]);
	recordExamples('listed', 'projects-required-statuses-without-fingerprints', [
		{
			name: 'Keeps the required status and omits both fingerprints',
			input: report,
			output: rows
		}
	]);
});

test('Records a reason for selected changed source', async () => {
	await withTempRepo(async (repo) => {
		initialize(repo);
		writeFile(
			repo.root,
			sourcePath,
			'export function quote(amount: number) { return amount + 2; }\n'
		);
		const input = reasonInput(repo.root, {
			base: 'HEAD',
			symbol: 'quote',
			recordedAt: '2026-11-15T10:00:00.000Z'
		});
		const entries = await explainAdd(input);
		expect(
			entries.map(({ unit, symbol, file, change, behavior: note }) => ({
				unit,
				symbol,
				file,
				change,
				behavior: note
			}))
		).toEqual([
			{
				unit: unitId,
				symbol: 'quote',
				file: sourcePath,
				change: 'modified',
				behavior
			}
		]);
		const saved = readFileSync(
			join(repo.root, '.cache/harness/explanations.ndjson'),
			'utf8'
		).trim();
		expect(saved).toEqual(JSON.stringify(entries[0]));
		recordExamples('explainAdd', 'records-a-reason-for-selected-changed-source', [
			{
				name: 'Records the selected function change with its writing attempts',
				input: {
					root: '<temporary Git repository>',
					base: 'HEAD',
					unit: unitId,
					symbol: ['quote'],
					behavior,
					simplification,
					simplificationOutcome: 'improved',
					performance,
					performanceOutcome: 'not-improved'
				},
				output: entries
			}
		]);
	});
});

test('Checks a range with a recorded reason', async () => {
	await withTempRepo(async (repo) => {
		const base = initialize(repo);
		writeFile(
			repo.root,
			sourcePath,
			'export function quote(amount: number) { return amount + 2; }\n'
		);
		const head = commit(repo, [sourcePath], 'fix: update quote formula');
		await explainAdd(
			reasonInput(repo.root, {
				base,
				symbol: 'quote',
				recordedAt: '2026-11-15T10:00:00.000Z',
				head
			})
		);
		const input = { root: repo.root, base, head };
		const report = await explainedRange(input);
		const required = report.required.map(({ from: _from, to: _to, ...status }) => status);
		const entries = report.entries.map(({ from: _from, to: _to, ...entry }) => entry);
		expect(required.map(({ symbol, state }) => [symbol, state])).toEqual([['quote', 'explained']]);
		expect(entries.map(({ symbol }) => symbol)).toEqual(['quote']);
		expect(report.failures).toEqual([]);
		recordExamples('explainedRange', 'checks-a-range-with-a-recorded-reason', [
			{
				name: 'Checks the committed function change against its recorded reason',
				input: { root: '<temporary Git repository>', base, head },
				output: {
					required,
					entries,
					overlong: report.overlong,
					failures: report.failures,
					root: '<temporary Git repository>'
				}
			}
		]);
	});
});
