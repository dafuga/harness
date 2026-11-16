import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { JobHistoryRepository } from '../../src/repositories/execution-runtimes/JobHistoryRepository';
import type { JobStart, JobEnd, JobRecord } from '../../src/repositories/execution-runtimes/JobHistoryRepository.types';

const startInput: JobStart = {
	id: 'run-17', source: 'workspace:alpha', attempt: 1, unit: 'service.api',
	type: 'verify', model: 'gpt-6-luna', startedAt: 1_000
};

test('Keeps the first start for a repeated attempt', async () => {
	await withTempDir('job-history-start-', (directory) => {
		const repository = new JobHistoryRepository(directory);
		try {
			const first = repository.start(startInput);
			const repeated = repository.start({ ...startInput, startedAt: 1_500 });
			expect(repeated.startedAt).toBe(1_000);
			recordExampleCases(
				{ unitId: 'repository.execution-runtimes-job-history', symbol: 'start', state: 'keeps-the-first-start-for-a-repeated-attempt', evidence: 'examples-cases', file: 'keeps-the-first-start-for-a-repeated-attempt.json' },
				[{ name: 'first start remains stored on duplicate', input: { first: startInput, repeatedStartedAt: 1_500 }, output: { startedAt: repeated.startedAt, recordCount: repository.all().length } }]
			);
			expect(first).toEqual(repeated);
		} finally {
			repository.close();
		}
	});
});

test('Completes an attempt once and preserves its first outcome', async () => {
	await withTempDir('job-history-end-', (directory) => {
		const repository = new JobHistoryRepository(directory);
		const endInput: JobEnd = { id: startInput.id, source: startInput.source, attempt: 1, endedAt: 1_750, outcome: 'pass' };
		try {
			repository.start(startInput);
			const completed = repository.end(endInput);
			const repeated = repository.end({ ...endInput, endedAt: 2_000, outcome: 'fail' });
			expect(repeated).toEqual(completed);
			recordExampleCases(
				{ unitId: 'repository.execution-runtimes-job-history', symbol: 'end', state: 'completes-an-attempt-once-and-preserves-its-first-outcome', evidence: 'examples-cases', file: 'completes-an-attempt-once-and-preserves-its-first-outcome.json' },
				[{ name: 'completion records elapsed time and retains first completion', input: endInput, output: { durationMs: completed.durationMs, outcome: repeated.outcome, endedAt: repeated.endedAt } }]
			);
			expect(completed.durationMs).toBe(750);
		} finally {
			repository.close();
		}
	});
});

test('Imports completed records and lists attempts', async () => {
	await withTempDir('job-history-import-', (directory) => {
		const repository = new JobHistoryRepository(directory);
		const imported: JobRecord = { ...startInput, id: 'imported-3', type: 'reverify', source: 'backfill:history', timingSource: 'file-mtime-minus-duration', endedAt: 1_400, durationMs: 400, outcome: 'cancelled' };
		try {
			const inserted = repository.import(imported);
			const duplicate = repository.import(imported);
			const records = repository.all();
			expect(inserted).toBe(true);
			expect(duplicate).toBe(false);
				recordExampleCases(
				{ unitId: 'repository.execution-runtimes-job-history', symbol: 'import', state: 'imports-completed-records-and-lists-attempts', evidence: 'examples-cases', file: 'imports-completed-records-and-lists-attempts.json' },
				[{ name: 'completed imported record appears once in insertion order', input: imported, output: { inserted, duplicate, records: records.map(({ id, outcome }) => ({ id, outcome })) } }]
			);
			expect(records).toHaveLength(1);
		} finally {
			repository.close();
		}
	});
});
