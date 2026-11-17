import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { previewHistoryPrune, renderPrune } from '../../src/cli/program/history-prune/previewHistoryPrune';

test('Reports an empty cache without changing files', async () => {
	await withTempRepo(async ({ root }) => {
		const now = new Date('2026-11-17T12:00:00.000Z');
		const inventory = await previewHistoryPrune(root, 3, 30, now);
		const report = renderPrune(inventory);
		expect(inventory.mode).toBe('report-only');
		expect(inventory.applySupported).toBe(false);
		expect(inventory.cutoff).toBe('2026-10-18T12:00:00.000Z');
		expect(inventory.entries).toEqual([]);
		expect(report).toContain('Report-only inventory: 0 records match keep-last 3 and older-than 30 days.');
		expect(report).toContain('No files were changed. Deletion is not supported; no --apply mode exists.');
		recordExampleCases(
			{
				unitId: 'entry.program-history-prune-preview-history-prune',
				symbol: 'previewHistoryPrune',
				state: 'reports-an-empty-cache-without-changing-files',
				evidence: 'examples-cases',
				file: 'reports-an-empty-cache-without-changing-files.json'
			},
			[
				{
				name: 'empty cache is report-only',
				input: { keepLast: 3, olderThanDays: 30, now: now.toISOString() },
				output: {
					mode: inventory.mode,
					applySupported: inventory.applySupported,
					keepLast: inventory.keepLast,
					olderThanDays: inventory.olderThanDays,
					cutoff: inventory.cutoff,
					entries: inventory.entries,
					problems: inventory.problems,
					report
				}
			}
			]
		);
	});
});
