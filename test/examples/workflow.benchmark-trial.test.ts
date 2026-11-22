import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { runBenchmarkTrial } from '../../src/cli/program/benchmark-service/benchmarkTrial';

type Input = Parameters<typeof runBenchmarkTrial>[0];

const TRIAL_ID = 'trial-1';

function makeInput(directory: string, persist: () => Promise<void>): Input {
	const trial = {
		id: TRIAL_ID,
		candidate: 'candidate-a',
		repetition: 1,
		status: 'running',
		submissions: [],
		turns: [],
		agentDurationMs: 0,
		evaluationDurationMs: 0,
		durationMs: 0,
		repairs: 0
	};
	const definition = {
		task: 'Implement the fixture parser.',
		contract: 'Parse the sample line into its fields.',
		allowedFiles: ['src/parser.ts'],
		checks: [{ name: 'unit', command: 'vitest run' }],
		budget: { timeoutMs: 5000, repairs: 1 }
	};
	return {
		run: { definition },
		trial,
		candidate: { id: 'candidate-a', instructions: 'Edit only the allowed files.' },
		runner: { run: () => Promise.reject(new Error('runner is not available in this example')) },
		directory,
		files: ['src/parser.ts'],
		signal: new AbortController().signal,
		persist
	} as unknown as Input;
}

test('Records a failed trial and removes its workspace', async () => {
	await withTempDir('benchmark-trial-setup-', async (directory) => {
		let persistCalls = 0;
		const input = makeInput(directory, () => {
			persistCalls++;
			return Promise.resolve();
		});

		await runBenchmarkTrial(input);

		expect(input.trial.status).toBe('error');
		expect(typeof input.trial.error).toBe('string');
		expect(input.trial.error).not.toBe('');
		expect(input.trial.durationMs).toBeGreaterThanOrEqual(0);
		expect(persistCalls).toBe(1);
		expect(existsSync(join(directory, TRIAL_ID))).toBe(false);
		recordExampleCases(
			{
				unitId: 'workflow.benchmark-trial',
				symbol: 'runBenchmarkTrial',
				state: 'records-a-failed-trial-and-removes-its-workspace',
				evidence: 'examples-cases',
				file: 'records-a-failed-trial-and-removes-its-workspace.json'
			},
			[
				{
					name: 'setup failure is recorded as an error and persisted once',
					input: { candidate: 'candidate-a', repetition: 1, timeoutMs: 5000, repairs: 1 },
					output: {
						status: input.trial.status,
						hasError: typeof input.trial.error === 'string',
						persistCalls,
						workspaceRemoved: !existsSync(join(directory, TRIAL_ID))
					}
				}
			]
		);
	});
});

test('Rejects when persisting the trial fails', async () => {
	await withTempDir('benchmark-trial-persist-', async (directory) => {
		let persistCalls = 0;
		const input = makeInput(directory, () => {
			persistCalls++;
			return Promise.reject(new Error('disk full'));
		});
		let error: unknown;
		try {
			await runBenchmarkTrial(input);
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe('disk full');
		expect(persistCalls).toBe(1);
		recordExampleCases(
			{
				unitId: 'workflow.benchmark-trial',
				symbol: 'runBenchmarkTrial',
				state: 'rejects-when-persisting-the-trial-fails',
				evidence: 'examples-cases',
				file: 'rejects-when-persisting-the-trial-fails.json'
			},
			[
				{
					name: 'persist rejection propagates unchanged from the finally block',
					input: { candidate: 'candidate-a', repetition: 1, timeoutMs: 5000, repairs: 1 },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	});
});
