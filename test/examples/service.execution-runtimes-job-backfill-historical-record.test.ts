import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	historicalIdentity,
	historicalOutcome,
	historicalAttempts,
	historicalModel
} from '../../src/services/execution-runtimes/job-backfill/historicalRecord';
import type { JobRecord } from '../../src/repositories/execution-runtimes/JobHistoryRepository.types';

const UNIT = 'service.execution-runtimes-job-backfill-historical-record';
const RESULT_PATH = '/runs/luna/result.json';

function meta(symbol: string, state: string) {
	return { unitId: UNIT, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

function reverifyRecord(): JobRecord {
	return { type: 'reverify', model: 'opus', endedAt: 100000 } as JobRecord;
}

test('Prefers explicit task and unit identity over folder names', () => {
	const explicitData = { task: 'backfill-7', unit_id: 'service.x' };
	const explicit = historicalIdentity(explicitData, RESULT_PATH);
	const fallback = historicalIdentity({}, RESULT_PATH);

	expect(explicit).toEqual({ id: 'backfill-7', unit: 'service.x' });
	expect(fallback).toEqual({ id: 'luna', unit: 'luna' });
	recordExampleCases(
		meta('historicalIdentity', 'prefers-explicit-task-and-unit-identity-over-folder-names'),
		[
			{
				name: 'explicit task and unit_id win over the folder',
				input: { data: explicitData, path: RESULT_PATH },
				output: explicit
			},
			{
				name: 'folder name is the fallback when no identity is recorded',
				input: { data: {}, path: RESULT_PATH },
				output: fallback
			}
		]
	);
});

test('Normalizes pass, fail, cancelled and missing outcomes', () => {
	const statuses = ['pass', 'pass-with-notes', 'cancelled', 'fail', undefined];
	const outcomes = statuses.map((status) => historicalOutcome(status));

	expect(outcomes).toEqual(['pass', 'pass', 'cancelled', 'fail', 'fail']);
	recordExampleCases(
		meta('historicalOutcome', 'normalizes-pass-fail-cancelled-and-missing-outcomes'),
		statuses.map((status, index) => ({
			name: `status ${String(status)} normalizes to ${outcomes[index]}`,
			input: { status },
			output: outcomes[index]
		}))
	);
});

test('Splits reverify attempts with their own model and time', () => {
	const data = {
		tried: [
			{ seconds: 1.5, model: 'luna', ok: false },
			{ seconds: 2, model: 'sonnet', ok: true }
		]
	};
	const record = reverifyRecord();
	const attempts = historicalAttempts(record, data);
	const other: JobRecord = { ...record, type: 'implement' };
	const single = historicalAttempts(other, data);

	expect(attempts.map((a) => [a.model, a.outcome, a.startedAt, a.endedAt, a.durationMs])).toEqual([
		['luna', 'fail', 96500, 98000, 1500],
		['sonnet', 'pass', 98000, 100000, 2000]
	]);
	expect(attempts[0].timingSource).toBe('file-mtime-minus-attempt-durations');
	expect(single).toEqual([other]);
	recordExampleCases(
		meta('historicalAttempts', 'splits-reverify-attempts-with-their-own-model-and-time'),
		[
			{
				name: 'two serial reverify attempts keep their models, outcomes and elapsed time',
				input: { record: { type: 'reverify', endedAt: 100000 }, data },
				output: attempts.map((a) => ({
					model: a.model,
					outcome: a.outcome,
					startedAt: a.startedAt,
					endedAt: a.endedAt,
					durationMs: a.durationMs
				}))
			},
			{
				name: 'non-reverify record stays a single job',
				input: { record: { type: 'implement' }, data },
				output: { count: single.length, type: single[0].type }
			}
		]
	);
});

test('Prefers explicit model metadata over directory names', () => {
	const explicit = historicalModel({ model: 'opus' }, 'unit-x');
	const worker = historicalModel({ worker: 'sol' }, 'unit-x');
	const inferred = historicalModel({}, 'luna');
	const unknown = historicalModel({}, 'service-folder');

	expect([explicit, worker, inferred, unknown]).toEqual(['opus', 'sol', 'luna', 'unknown']);
	recordExampleCases(
		meta('historicalModel', 'prefers-explicit-model-metadata-over-directory-names'),
		[
			{
				name: 'explicit model field wins',
				input: { data: { model: 'opus' }, directory: 'unit-x' },
				output: explicit
			},
			{
				name: 'worker field is used when no model is recorded',
				input: { data: { worker: 'sol' }, directory: 'unit-x' },
				output: worker
			},
			{
				name: 'recognized model directory is accepted',
				input: { data: {}, directory: 'luna' },
				output: inferred
			},
			{
				name: 'unrecognized folder stays unknown',
				input: { data: {}, directory: 'service-folder' },
				output: unknown
			}
		]
	);
});
