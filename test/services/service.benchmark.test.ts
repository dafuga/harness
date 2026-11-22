import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, test, vi } from 'vitest';
import type { PreparedBenchmark } from '../../src/cli/program/benchmark-service/benchmarkDefinition';
import { BenchmarkDefinitionValidator } from '../../src/cli/program/benchmark-service/benchmark-definition/BenchmarkDefinitionValidator';
import { BenchmarkService } from '../../src/cli/program/benchmark-service/BenchmarkService';
import type { BenchmarkRun } from '../../src/core/agents-providers/subagentBenchmarkTypes';
import { ExpectedCliError } from '../../src/core/development-tooling/errors';
import { BenchmarkRepository } from '../../src/repositories/agents-providers/BenchmarkRepository';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';
import type { Rendered } from './service.benchmark.test.types';
import { failedTrial, passedTrial } from './service.benchmark.fixtures';

/** Each state calls BenchmarkService.execute once; what it was given and what it returned are recorded. */
const unitId = 'service.benchmark';
const symbol = 'BenchmarkService.execute';
const evidence = 'examples-cases';
const runId = '5b7e2c4d-1f3a-4e8b-9c6d-2a7f0e9b1d3c';
const revision = '9f1c2d3e4a5b6c7d8e9f0a1b2c3d4e5f60718293';
const definitionSource = {
	version: 1,
	name: 'component-value',
	task: 'Return one',
	contract: 'Export value equal to 1',
	allowedFiles: ['component.ts'],
	checks: [{ id: 'contract', command: 'bun check.ts' }],
	candidates: [{ id: 'agent', runner: 'codex', model: 'explicit-model', effort: 'medium' }],
	budget: { repetitions: 2, timeoutMs: 10000, repairs: 2 }
};
afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

/** Points the analytics home, where benchmark runs are kept, at the given directory. */
function analyticsHome(directory: string): void {
	vi.stubEnv('HARNESS_ANALYTICS_HOME', directory);
}

/** Runs git in a fixture repository under a fixed identity, so commits do not depend on the machine. */
function git(cwd: string, ...args: string[]): string {
	const identity = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid'];
	return execFileSync('git', [...identity, ...args], { cwd, encoding: 'utf8' }).trim();
}

/** The text the service handed to console.log, one entry per call, joined by newlines. */
function printed(calls: unknown[][]): string {
	return calls.map((args) => String(args[0])).join('\n');
}

/** Saves the two-trial run where `benchmark run` saves it, in the analytics home at `directory`. */
async function persistSeededRun(directory: string): Promise<BenchmarkRun> {
	analyticsHome(directory);
	const run: BenchmarkRun = {
		version: 1,
		id: runId,
		project: '/projects/component-value',
		revision,
		fingerprint: 'a3f9c1d0e2b4',
		seed: 'stable',
		definition: new BenchmarkDefinitionValidator().validate(definitionSource),
		runnerVersions: { agent: 'codex fixture 1' },
		startedAt: '2026-11-15T09:30:00.000Z',
		completedAt: '2026-11-15T09:31:00.000Z',
		trials: [passedTrial, failedTrial]
	};
	await new BenchmarkRepository().save(run);
	return run;
}

test('execute called with validate on a definition file prints its preview with the revision, runner version and trial count', async () => {
	await withTempDir('service-benchmark-examples-', async (home) => {
		const bin = join(home, 'bin');
		mkdirSync(bin);
		writeFileSync(join(bin, 'codex'), '#!/bin/sh\necho "codex fixture 1"\n');
		chmodSync(join(bin, 'codex'), 0o755);
		vi.stubEnv('PATH', `${bin}:${process.env.PATH ?? ''}`);
		analyticsHome(home);
		await withTempRepo(async ({ root }) => {
			writeFileSync(join(root, 'component.ts'), 'export const value = 0;\n');
			git(root, 'add', 'component.ts');
			git(root, '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture');
			const path = join(root, 'benchmark.json');
			writeFileSync(path, JSON.stringify(definitionSource));
			const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
			await new BenchmarkService().execute('validate', path, {});
			const preview = JSON.parse(printed(log.mock.calls)) as PreparedBenchmark;
			expect(preview.definition.name).toBe('component-value');
			expect(preview.runnerVersions).toEqual({ agent: 'codex fixture 1' });
			expect(preview.trials).toBe(2);
			expect(preview.revision).toBe(git(root, 'rev-parse', 'HEAD'));
			recordExampleCases(
				{
					unitId,
					symbol,
					state: 'validate-definition',
					evidence,
					file: 'validate-definition.json'
				},
				[
					{
						name: 'benchmark.json at the root of its repository, with one codex candidate',
						input: { operation: 'validate', target: 'benchmark.json', options: {} },
						output: {
							name: preview.definition.name,
							revision: preview.revision,
							runnerVersions: preview.runnerVersions,
							trials: preview.trials
						}
					}
				]
			);
		}, 'service-benchmark-examples-');
	});
}, 20000);

test('execute called with results for a persisted run prints the run and a table comparing its candidates', async () => {
	await withTempDir('service-benchmark-examples-', async (directory) => {
		const run = await persistSeededRun(directory);
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		await new BenchmarkService().execute('results', run.id, {});
		const lines = printed(log.mock.calls).split('\n');
		expect(lines).toEqual([
			'Benchmark: component-value',
			`Run: ${runId}`,
			`Revision: ${revision}`,
			'Candidate | Trials | First submission | Eventually passed | Median successful ms | Outcomes',
			'agent | 2 | 1/2 | 1/2 | 1400 | {"passed":1,"failed":1}',
			'Usage and reported cost are available with --json; unknown values are not zero.'
		]);
		recordExampleCases(
			{ unitId, symbol, state: 'results-table', evidence, file: 'results-table.json' },
			[
				{
					name: 'persisted run of one candidate with two trials, printed as a table',
					input: { operation: 'results', target: run.id, options: {} },
					output: lines
				}
			]
		);
	});
});

test('execute called with results and json output prints the persisted run and its comparison as JSON', async () => {
	await withTempDir('service-benchmark-examples-', async (directory) => {
		const run = await persistSeededRun(directory);
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		await new BenchmarkService().execute('results', run.id, { json: true });
		const result = JSON.parse(printed(log.mock.calls)) as Rendered;
		expect(result.run).toEqual(run);
		expect(result.comparison).toMatchObject([
			{
				candidate: 'agent',
				trials: 2,
				successes: 1,
				medianSuccessfulDurationMs: 1400,
				outcomes: { passed: 1, failed: 1 },
				usage: { inputTokens: 22, outputTokens: 5, cacheReadTokens: null },
				reportedCostUsd: null
			}
		]);
		recordExampleCases(
			{ unitId, symbol, state: 'results-json', evidence, file: 'results-json.json' },
			[
				{
					name: 'persisted run with json output selected',
					input: { operation: 'results', target: run.id, options: { json: true } },
					output: {
						run: { id: result.run.id, trials: result.run.trials.map((trial) => trial.status) },
						comparison: result.comparison
					}
				}
			]
		);
	});
});

test('execute called with results for a target that is not a run ID rejects with an expected CLI error', async () => {
	await withTempDir('service-benchmark-examples-', async (directory) => {
		analyticsHome(directory);
		const rejected = new BenchmarkService().execute('results', 'not-a-run', {});
		await expect(rejected).rejects.toBeInstanceOf(ExpectedCliError);
		const message = await rejected.catch((error: Error) => error.message);
		expect(message).toBe('Invalid benchmark run ID.');
		recordExampleCases(
			{ unitId, symbol, state: 'invalid-run-id', evidence, file: 'invalid-run-id.json' },
			[
				{
					name: 'target that is not a benchmark run ID',
					input: { operation: 'results', target: 'not-a-run', options: {} },
					error: message
				}
			]
		);
	});
});
