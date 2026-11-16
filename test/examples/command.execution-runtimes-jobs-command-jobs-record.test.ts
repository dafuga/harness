import { join } from 'node:path';
import { test } from 'vitest';
import { JobHistoryRepository } from '../../src/repositories/execution-runtimes/JobHistoryRepository';
import type { JobRecord } from '../../src/repositories/execution-runtimes/JobHistoryRepository.types';
import { jobsRecord } from '../../src/commands/execution-runtimes/jobs-command/jobsRecord';
import type { JobsOptions } from '../../src/commands/execution-runtimes/JobsCommand.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

function recordFields(record: JobRecord) {
	return {
		id: record.id,
		source: record.source,
		attempt: record.attempt,
		unit: record.unit,
		type: record.type,
		model: record.model,
		startedAt: record.startedAt,
		timingSource: record.timingSource,
		...(record.endedAt === undefined
			? {}
			: { endedAt: record.endedAt, durationMs: record.durationMs, outcome: record.outcome })
	};
}

async function withExampleHistory(prefix: string, use: (history: JobHistoryRepository) => void) {
	await withTempDir(prefix, (directory) => {
		const history = new JobHistoryRepository(join(directory, 'history'));
		try {
			use(history);
		} finally {
			history.close();
		}
	});
}

function startAttempts(history: JobHistoryRepository): void {
	const explicitFlags: JobsOptions = {
		id: 'job-42',
		source: 'runner:run-17',
		attempt: '2',
		at: '2026-11-16T10:15:00+01:00',
		unit: 'src/workflows/release.ts',
		type: 'typescript',
		model: 'fixture-model'
	};
	const defaultFlags: JobsOptions = {
		id: 'job-43',
		source: 'runner:run-18',
		at: '2026-11-16T11:30:00Z',
		unit: 'src/workflows/test.ts',
		type: 'typescript',
		model: 'fixture-model'
	};
	const explicit = jobsRecord(history, 'start', explicitFlags);
	const defaulted = jobsRecord(history, 'start', defaultFlags);
	expect([explicit.attempt, defaulted.attempt]).toEqual([2, 1]);
	expect([explicit.startedAt, defaulted.startedAt]).toEqual([
		Date.parse(explicitFlags.at!),
		Date.parse(defaultFlags.at!)
	]);
	const stored = history.all().map(recordFields);
	expect(stored).toEqual([recordFields(explicit), recordFields(defaulted)]);
	recordExampleCases(
		{
			unitId: 'command.execution-runtimes-jobs-command-jobs-record',
			symbol: 'jobsRecord',
			state: 'starts-job-attempts-and-defaults-the-attempt-number',
			evidence: 'examples-cases',
			file: 'starts-job-attempts-and-defaults-the-attempt-number.json'
		},
		[
			{
				name: 'start an explicitly numbered attempt at an offset timestamp',
				input: { history: 'temporary SQLite repository', phase: 'start', flags: explicitFlags },
				output: { returned: recordFields(explicit), stored: stored[0] }
			},
			{
				name: 'start without an attempt flag defaults to attempt one',
				input: { history: 'temporary SQLite repository', phase: 'start', flags: defaultFlags },
				output: { returned: recordFields(defaulted), stored: stored[1] }
			}
		]
	);
}

function completeAttempt(history: JobHistoryRepository): void {
	const startFlags: JobsOptions = {
		id: 'job-51',
		source: 'runner:run-21',
		attempt: '3',
		at: '2026-11-16T10:00:00Z',
		unit: 'src/workflows/deploy.ts',
		type: 'typescript',
		model: 'fixture-model'
	};
	const endFlags: JobsOptions = {
		id: 'job-51',
		source: 'runner:run-21',
		attempt: '3',
		at: '2026-11-16T10:00:04Z',
		outcome: 'pass'
	};
	const started = jobsRecord(history, 'start', startFlags);
	const completed = jobsRecord(history, 'end', endFlags);
	const expected = {
		...recordFields(started),
		endedAt: Date.parse(endFlags.at!),
		durationMs: 4000,
		outcome: 'pass'
	};
	expect(recordFields(completed)).toEqual(expected);
	const stored = history.all().map(recordFields);
	expect(stored).toEqual([expected]);
	recordExampleCases(
		{
			unitId: 'command.execution-runtimes-jobs-command-jobs-record',
			symbol: 'jobsRecord',
			state: 'completes-an-existing-attempt-and-returns-its-duration',
			evidence: 'examples-cases',
			file: 'completes-an-existing-attempt-and-returns-its-duration.json'
		},
		[
			{
				name: 'record a passing completion four seconds after start',
				input: {
					history: 'temporary SQLite repository',
					started: { phase: 'start', flags: startFlags },
					completion: { phase: 'end', flags: endFlags }
				},
				output: { returned: recordFields(completed), stored: stored[0] }
			}
		]
	);
}

function rejectTimezoneLessTimestamp(history: JobHistoryRepository): void {
	const flags: JobsOptions = {
		id: 'job-60',
		source: 'runner:run-25',
		at: '2026-11-16T10:05:00',
		unit: 'src/workflows/check.ts',
		type: 'typescript',
		model: 'fixture-model'
	};
	let thrown: unknown;
	try {
		jobsRecord(history, 'start', flags);
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(RangeError);
	expect((thrown as RangeError).message).toBe('--at requires an ISO timestamp with timezone');
	expect(history.all()).toEqual([]);
	recordExampleCases(
		{
			unitId: 'command.execution-runtimes-jobs-command-jobs-record',
			symbol: 'jobsRecord',
			state: 'rejects-a-timestamp-that-omits-its-timezone',
			evidence: 'examples-cases',
			file: 'rejects-a-timestamp-that-omits-its-timezone.json'
		},
		[
			{
				name: 'start with an ISO timestamp that has no timezone suffix',
				input: { history: 'temporary SQLite repository', phase: 'start', flags },
				error: {
					name: (thrown as RangeError).name,
					message: (thrown as RangeError).message
				}
			}
		]
	);
}

test('Starts job attempts and defaults the attempt number', async () => {
	await withExampleHistory('jobs-record-start-', startAttempts);
});

test('Completes an existing attempt and returns its duration', async () => {
	await withExampleHistory('jobs-record-end-', completeAttempt);
});

test('Rejects a timestamp that omits its timezone', async () => {
	await withExampleHistory('jobs-record-invalid-timezone-', rejectTimezoneLessTimestamp);
});
