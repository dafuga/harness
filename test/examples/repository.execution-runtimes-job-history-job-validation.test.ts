import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { ZodError } from 'zod';
import {
	jobRecord,
	jobKey
} from '../../src/repositories/execution-runtimes/job-history/jobValidation';

const validRecord = {
	id: 'run-42',
	source: 'worker-a',
	attempt: 2,
	unit: 'repository.example',
	type: 'test',
	model: 'gpt-6-luna',
	startedAt: 100,
	endedAt: 145,
	durationMs: 45,
	outcome: 'pass' as const
};

test('Validates completed job lifecycle timing', () => {
	const record = jobRecord(validRecord);
	expect(record).toEqual(validRecord);
	recordExampleCases(
		{
			unitId: 'repository.execution-runtimes-job-history-job-validation',
			symbol: 'jobRecord',
			state: 'validates-completed-job-lifecycle-timing',
			evidence: 'examples-cases',
			file: 'validates-completed-job-lifecycle-timing.json'
		},
		[
			{
				name: 'completed pass retains matching start, end and duration',
				input: validRecord,
				output: record
			}
		]
	);
});

test('Builds stable source job attempt key', () => {
	const key = { source: 'worker-a', id: 'run-42', attempt: 2 };
	const result = jobKey(key);
	expect(result).toBe('["worker-a","run-42",2]');
	recordExampleCases(
		{
			unitId: 'repository.execution-runtimes-job-history-job-validation',
			symbol: 'jobKey',
			state: 'builds-stable-source-job-attempt-key',
			evidence: 'examples-cases',
			file: 'builds-stable-source-job-attempt-key.json'
		},
		[
			{
				name: 'source and attempt remain distinct in compact tuple',
				input: key,
				output: result
			}
		]
	);
});

test('Throws RangeError for incomplete completion timing', () => {
	const input = { ...validRecord, durationMs: undefined };
	expect(() => jobRecord(input)).toThrow(RangeError);
	recordExampleCases(
		{
			unitId: 'repository.execution-runtimes-job-history-job-validation',
			symbol: 'jobRecord',
			state: 'throws-rangeerror-for-incomplete-completion-timing',
			evidence: 'examples-cases',
			file: 'throws-rangeerror-for-incomplete-completion-timing.json'
		},
		[
			{
				name: 'completed record without duration is rejected',
				input,
				error: { name: 'RangeError', message: 'Invalid completed job timing' }
			}
		]
	);
});

test('Throws ZodError for malformed job identity', () => {
	const input = { ...validRecord, id: '' };
	expect(() => jobRecord(input)).toThrow(ZodError);
	recordExampleCases(
		{
			unitId: 'repository.execution-runtimes-job-history-job-validation',
			symbol: 'jobRecord',
			state: 'throws-zoderror-for-malformed-job-identity',
			evidence: 'examples-cases',
			file: 'throws-zoderror-for-malformed-job-identity.json'
		},
		[
			{
				name: 'empty job id is rejected by the lifecycle schema',
				input,
				error: { name: 'ZodError', message: 'id must be nonempty' }
			}
		]
	);
});
