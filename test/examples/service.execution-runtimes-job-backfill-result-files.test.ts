import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { resultFiles } from '../../src/services/execution-runtimes/job-backfill/resultFiles';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Finds sorted result files in bounded result collections', async () => {
	await withTempDir('job-backfill-result-files-', async (directory) => {
		const resultsA = join(directory, 'results-2026-a');
		const resultsB = join(directory, 'results-2026-b');
		const nested = join(resultsA, 'attempt-1');
		mkdirSync(nested, { recursive: true });
		mkdirSync(resultsB);
		mkdirSync(join(directory, 'logs'));
		writeFileSync(join(nested, 'result.json'), '{"status":"ok"}');
		writeFileSync(join(resultsB, 'result.json'), '{"status":"failed"}');
		writeFileSync(join(directory, 'logs', 'result.json'), '{}');
		const files = resultFiles(directory);
		const output = files.map((path) => path.slice(directory.length + 1));

		expect(output).toEqual([
			'results-2026-a/attempt-1/result.json',
			'results-2026-b/result.json'
		]);
		recordExampleCases(
			{
				unitId: 'service.execution-runtimes-job-backfill-result-files',
				symbol: 'resultFiles',
				state: 'finds-sorted-result-files-in-bounded-result-collections',
				evidence: 'examples-cases',
				file: 'finds-sorted-result-files-in-bounded-result-collections.json'
			},
			[
				{
					name: 'returns sorted result paths from results collections and skips logs',
					input: {
						root: 'temporary historical results root',
						collections: ['results-2026-a/attempt-1/result.json', 'results-2026-b/result.json'],
						ignored: ['logs/result.json']
					},
					output
				}
			]
		);
	});
});

test('Throws when a results folder is unreadable', async () => {
	await withTempDir('job-backfill-result-files-missing-', async (directory) => {
		const missing = join(directory, 'missing-results');
		let code = '';
		try {
			resultFiles(missing);
		} catch (error) {
			if (error instanceof Error && 'code' in error) code = String(error.code);
		}
		expect(() => resultFiles(missing)).toThrow();
		expect(code).toBe('ENOENT');
		recordExampleCases(
			{
				unitId: 'service.execution-runtimes-job-backfill-result-files',
				symbol: 'resultFiles',
				state: 'throws-when-a-results-folder-is-unreadable',
				evidence: 'examples-cases',
				file: 'throws-when-a-results-folder-is-unreadable.json'
			},
			[
				{
					name: 'propagates ENOENT when the historical results root is missing',
					input: { root: 'temporary/missing-results' },
					output: { code }
				}
			]
		);
	});
});
