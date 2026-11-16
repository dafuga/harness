import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
