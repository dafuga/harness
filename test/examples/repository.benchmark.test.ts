import type { Run, Cases } from './repository.benchmark.test.types';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { BenchmarkRepository } from '../../src/repositories/agents-providers/BenchmarkRepository';
import { InvalidBenchmarkRunIdError } from '../../src/repositories/agents-providers/BenchmarkRepository.types';

const RUN_ID = '3f2a9c1e-7b4d-4e8a-9c6f-1a2b3c4d5e6f';

function makeRun(ownerPid?: number): Run {
	return {
		version: 1,
		id: RUN_ID,
		project: '/workspace/project',
		revision: 'e6b1f0c2d9a47358be12f0c9d7a64a1e3f85b270',
		fingerprint: '5f0c9e2b7a4d1836c0e9f27b4a5d8e13f6c2b9a07d4e1f58c3b6a2d9e0f7c146',
		seed: 'comparison-1',
		definition: {
			version: 1,
			name: 'cart-discount-check',
			project: '.',
			revision: 'main',
			task: 'Reject expired discount codes at checkout.',
			contract: 'Keep the public signature of applyDiscount() unchanged.',
			allowedFiles: ['src/checkout/discount.ts'],
			checks: [{ id: 'typecheck', command: 'npm run typecheck' }],
			setup: ['npm ci'],
			candidates: [
				{
					id: 'codex-fast',
					runner: 'codex',
					model: 'gpt-6-luna',
					effort: 'low',
					instructions: '',
					tools: 'default'
				}
			],
			budget: { repetitions: 3, timeoutMs: 900000, repairs: 2 }
		},
		runnerVersions: { 'codex-fast': 'codex-cli 0.92.0' },
		startedAt: '2026-11-15T09:30:12.418Z',
		ownerPid,
		trials: [
			{
				id: 'b7d2e4a0-19c5-4f3e-8a6b-2c9d0e1f7a53',
				candidate: 'codex-fast',
				repetition: 1,
				status: 'running',
				submissions: [],
				turns: [],
				agentDurationMs: 0,
				evaluationDurationMs: 0,
				durationMs: 0,
				repairs: 0
			}
		]
	};
}

function record(state: string, symbol: string, cases: Cases): void {
	recordExampleCases(
		{
			unitId: 'repository.benchmark',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

async function failureOf(work: Promise<unknown>): Promise<{ name: string; message: string }> {
	try {
		await work;
	} catch (caught) {
		const error = caught as Error;
		return { name: error.name, message: error.message };
	}
	throw new Error('Expected the promise to reject.');
}

test('Saves and reads back a run record', async () => {
	await withTempDir('benchmark-roundtrip-', async (directory) => {
		const repository = new BenchmarkRepository(directory);
		// The owner is this live test process, so the running trial stays running.
		const run = makeRun(process.pid);
		await repository.save(run);
		const read = await repository.read(RUN_ID);

		expect(read).toEqual(run);
		expect(repository.directory(RUN_ID)).toBe(join(directory, RUN_ID));
		record('saves-and-reads-back-a-run-record', 'save', [
			{
				name: 'saved run reads back with its trial status unchanged',
				input: { id: RUN_ID, ownerPid: process.pid },
				output: {
					id: read.id,
					trialStatuses: read.trials.map((trial) => trial.status)
				}
			}
		]);
	});
});

test('Rejects a run ID that is not a UUID', async () => {
	await withTempDir('benchmark-invalid-id-', async (directory) => {
		const repository = new BenchmarkRepository(directory);
		expect(() => repository.directory('../escape')).toThrow(InvalidBenchmarkRunIdError);
		const readFailure = await failureOf(repository.read('not-a-run'));
		const saveFailure = await failureOf(repository.save({ ...makeRun(), id: 'NOT-HEX' }));

		expect(readFailure.message).toBe('Invalid benchmark run ID.');
		expect(saveFailure.message).toBe('Invalid benchmark run ID.');
		record('rejects-a-run-id-that-is-not-a-uuid', 'directory', [
			{
				name: 'directory rejects a path-like run ID',
				input: { id: '../escape' },
				error: { name: 'InvalidBenchmarkRunIdError', message: 'Invalid benchmark run ID.' }
			},
			{
				name: 'read rejects a short run ID',
				input: { id: 'not-a-run' },
				error: readFailure
			},
			{
				name: 'save rejects an upper-case run ID',
				input: { id: 'NOT-HEX' },
				error: saveFailure
			}
		]);
	});
});

test('Reads running trials as interrupted without an owner pid', async () => {
	await withTempDir('benchmark-interrupted-', async (directory) => {
		const repository = new BenchmarkRepository(directory);
		await repository.save(makeRun());
		const read = await repository.read(RUN_ID);
		const onDisk = JSON.parse(
			await readFile(join(repository.directory(RUN_ID), 'run.json'), 'utf8')
		) as Run;

		expect(read.trials[0]?.status).toBe('interrupted');
		expect(onDisk.trials[0]?.status).toBe('running');
		record('reads-running-trials-as-interrupted-without-an-owner-pid', 'read', [
			{
				name: 'running trial without owner pid is reported interrupted, file keeps running',
				input: { id: RUN_ID, ownerPid: null },
				output: {
					returnedStatus: read.trials[0]?.status,
					storedStatus: onDisk.trials[0]?.status
				}
			}
		]);
	});
});
