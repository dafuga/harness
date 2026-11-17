import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportCleanupLog } from '../../src/services/reports-media/report-command-service/report-retention-service/reportCleanupLog';

function result(deletedReports: string[], dryRun: boolean) {
	return {
		plannedReports: ['report-2026-11.json'],
		deletedReports,
		cloudObjects: deletedReports.length,
		pages: 1,
		localFiles: deletedReports.length,
		errors: [],
		dryRun
	};
}

function parseLines(contents: string) {
	return contents.trim().split('\n').map((line) => JSON.parse(line));
}

test('Appends cleanup results to retention history', async () => {
	const root = mkdtempSync(join(tmpdir(), 'report-cleanup-log-'));
	try {
		const firstResult = result(['report-2026-10.json'], false);
		const secondResult = result([], true);
		await reportCleanupLog(root, firstResult);
		await reportCleanupLog(root, secondResult);
		const lines = parseLines(readFileSync(join(root, 'retention-history.jsonl'), 'utf8'));
		expect(lines).toHaveLength(2);
		expect(lines.map((line) => line.result)).toEqual([firstResult, secondResult]);
		expect(lines.every((line) => typeof line.executedAt === 'string')).toBe(true);
		recordExampleCases(
			{
				unitId: 'reports.function.report-cleanup-log',
				symbol: 'reportCleanupLog',
				state: 'appends-cleanup-results-to-retention-history',
				evidence: 'examples-cases',
				file: 'appends-cleanup-results-to-retention-history.json'
			},
			[
				{
					name: 'records a completed deletion',
					input: { root: 'temporary-report-store', result: firstResult },
					output: { entries: 1, result: firstResult }
				},
				{
					name: 'records a dry run after the previous entry',
					input: { root: 'temporary-report-store', result: secondResult },
					output: { entries: 2, result: secondResult }
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws NodeJS.ErrnoException when reading history fails with a non-ENOENT error', async () => {
	const root = mkdtempSync(join(tmpdir(), 'report-cleanup-log-read-error-'));
	try {
		mkdirSync(join(root, 'retention-history.jsonl'));
		let caught: unknown;
		try {
			await reportCleanupLog(root, result([], false));
		} catch (error) {
			caught = error;
		}
		expect(caught).toMatchObject({ code: 'EISDIR' });
		recordExampleCases(
			{
				unitId: 'reports.function.report-cleanup-log',
				symbol: 'reportCleanupLog',
				state: 'throws-nodejs-errnoexception-when-reading-history-fails-with',
				evidence: 'examples-cases',
				file: 'throws-nodejs-errnoexception-when-reading-history-fails-with.json'
			},
			[{ name: 'history path is a directory', input: { root, result: result([], false) }, error: { code: 'EISDIR' } }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws Error when writing history fails because the root is missing', async () => {
	const parent = mkdtempSync(join(tmpdir(), 'report-cleanup-log-write-error-'));
	const root = join(parent, 'missing-root');
	try {
		await expect(reportCleanupLog(root, result([], false))).rejects.toBeInstanceOf(Error);
		recordExampleCases(
			{
				unitId: 'reports.function.report-cleanup-log',
				symbol: 'reportCleanupLog',
				state: 'throws-error-when-writing-history-fails-because-the-root-is',
				evidence: 'examples-cases',
				file: 'throws-error-when-writing-history-fails-because-the-root-is.json'
			},
			[{ name: 'root directory does not exist', input: { root, result: result([], false) }, error: { code: 'ENOENT' } }]
		);
	} finally {
		rmSync(parent, { recursive: true, force: true });
	}
});

test('Throws TypeError when cleanup result cannot be serialized', async () => {
	const root = mkdtempSync(join(tmpdir(), 'report-cleanup-log-serialize-error-'));
	try {
		const invalidResult = { value: BigInt(1) };
		await expect(reportCleanupLog(root, invalidResult as never)).rejects.toBeInstanceOf(TypeError);
		recordExampleCases(
			{
				unitId: 'reports.function.report-cleanup-log',
				symbol: 'reportCleanupLog',
				state: 'throws-typeerror-when-cleanup-result-cannot-be-serialized',
				evidence: 'examples-cases',
				file: 'throws-typeerror-when-cleanup-result-cannot-be-serialized.json'
			},
			[{ name: 'result contains BigInt', input: { root: 'temporary-report-store', result: 'BigInt value' }, error: { name: 'TypeError' } }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
