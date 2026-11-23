import { fixtureRunners } from './workflow.run-benchmark.fixture';
import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withTempDir } from '../support/temporary';
import { test, vi } from 'vitest';
import { BenchmarkRepository } from '../../src/repositories/agents-providers/BenchmarkRepository';
import {
	benchmarkSchedule,
	runBenchmark
} from '../../src/cli/program/benchmark-service/runBenchmark';

import type { BenchmarkRun } from '../../src/core/agents-providers/subagentBenchmarkTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import type { TemporaryRepo } from '../support/temporary.types';
import { expect } from '../verificationExpect';

const recordedAnalytics = vi.hoisted(() => ({ events: [] as unknown[] }));
vi.mock('../../src/repositories/reports-media/AnalyticsRepository', () => ({
	AnalyticsRepository: {
		open: async () => ({
			record: (event: unknown) => recordedAnalytics.events.push(event),
			close: () => {}
		})
	}
}));

const scheduleRun = {
	seed: 'c81e7f3a-0d4b-4a92-8e15-7b3c9d2f6e10',
	definition: {
		candidates: [{ id: 'codex-high' }, { id: 'claude-sonnet' }],
		budget: { repetitions: 1 }
	}
} as BenchmarkRun;

function commitBenchmarkFixture(repo: TemporaryRepo): void {
	writeFileSync(join(repo.root, 'component.ts'), 'export const value = 0;\n');
	const checkPath = join(repo.root, 'check-value.sh');
	writeFileSync(checkPath, '#!/bin/sh\n[ "$(cat component.ts)" = "export const value = 1;" ]\n');
	chmodSync(checkPath, 0o700);
	repo.git('add', '--all');
	repo.git('commit', '-m', 'Create benchmark fixture');
}

function writeBenchmarkDefinition(repo: TemporaryRepo): string {
	const definition = {
		version: 1,
		name: 'component-value',
		project: '.',
		revision: 'HEAD',
		task: 'Set the component value to one.',
		contract: 'component.ts exports value equal to one.',
		allowedFiles: ['component.ts'],
		checks: [{ id: 'value', command: './check-value.sh' }],
		setup: [],
		candidates: [
			{
				id: 'codex-pass',
				runner: 'codex',
				model: 'fixture-codex',
				effort: 'high',
				instructions: '',
				tools: 'default'
			},
			{
				id: 'claude-error',
				runner: 'claude',
				model: 'fixture-claude',
				effort: 'medium',
				instructions: '',
				tools: 'default'
			}
		],
		budget: { repetitions: 1, timeoutMs: 10000, repairs: 0 }
	};
	const path = join(repo.root, 'benchmark.json');
	writeFileSync(path, JSON.stringify(definition));
	return path;
}

async function runBenchmarkExample(repo: TemporaryRepo) {
	recordedAnalytics.events.length = 0;
	vi.stubEnv('HARNESS_ANALYTICS_DISABLED', '0');
	try {
		commitBenchmarkFixture(repo);
		const path = writeBenchmarkDefinition(repo);
		const repository = new BenchmarkRepository(join(repo.root, 'runs'));
		const run = await runBenchmark({
			path,
			runners: fixtureRunners(),
			repository,
			signal: new AbortController().signal,
			seed: 'value-run-seed'
		});
		return summarizeRun(run, await repository.read(run.id));
	} finally {
		vi.unstubAllEnvs();
	}
}

function summarizeRun(run: BenchmarkRun, saved: BenchmarkRun) {
	const trials = run.trials
		.map(({ candidate, status, error, submissions }) => ({
			candidate,
			status,
			error: error ?? null,
			checkExitCode: submissions[0]?.checks[0]?.exitCode ?? null
		}))
		.sort((left, right) => left.candidate.localeCompare(right.candidate));
	const savedTrials = saved.trials
		.map(({ candidate, status }) => ({ candidate, status }))
		.sort((left, right) => left.candidate.localeCompare(right.candidate));
	const events = recordedAnalytics.events.filter(
		(event): event is { kind: string; project: string } =>
			typeof event === 'object' &&
			event !== null &&
			'kind' in event &&
			event.kind === 'benchmark' &&
			'project' in event &&
			typeof event.project === 'string'
	);
	return {
		completed: Boolean(run.completedAt),
		trials,
		savedTrials,
		analyticsEvents: events.length,
		analyticsAttributedToProject: events.every((event) => event.project === run.project)
	};
}

test('Schedules candidates in a seeded order', () => {
	const output = benchmarkSchedule(scheduleRun);
	expect(output).toEqual([
		{ candidate: 'codex-high', repetition: 1 },
		{ candidate: 'claude-sonnet', repetition: 1 }
	]);
	recordExampleCases(
		{
			unitId: 'workflow.run-benchmark',
			symbol: 'benchmarkSchedule',
			state: 'schedules-candidates-in-a-seeded-order',
			evidence: 'examples-cases',
			file: 'schedules-candidates-in-a-seeded-order.json'
		},
		[
			{
				name: 'A fixed seed orders one trial for each retry-fix candidate',
				input: {
					seed: scheduleRun.seed,
					candidates: scheduleRun.definition.candidates.map(({ id }) => id),
					repetitions: scheduleRun.definition.budget.repetitions
				},
				output
			}
		]
	);
});

test('Persists benchmark outcomes before returning', async () => {
	const output = await withTempRepo(runBenchmarkExample);
	expect(output).toEqual({
		completed: true,
		trials: [
			{
				candidate: 'claude-error',
				status: 'error',
				error: 'claude-error fixture failure',
				checkExitCode: null
			},
			{ candidate: 'codex-pass', status: 'passed', error: null, checkExitCode: 0 }
		],
		savedTrials: [
			{ candidate: 'claude-error', status: 'error' },
			{ candidate: 'codex-pass', status: 'passed' }
		],
		analyticsEvents: 2,
		analyticsAttributedToProject: true
	});
	recordExampleCases(
		{
			unitId: 'workflow.run-benchmark',
			symbol: 'runBenchmark',
			state: 'persists-benchmark-outcomes-before-returning',
			evidence: 'examples-cases',
			file: 'persists-benchmark-outcomes-before-returning.json'
		},
		[
			{
				name: 'Saves a passing trial and records a runner failure under the source project',
				input: {
					path: '<temporary benchmark.json>',
					project: '<temporary Git repository>',
					seed: 'value-run-seed',
					candidates: ['codex-pass', 'claude-error'],
					runners: { codex: 'writes allowed file', claude: 'throws fixture error' },
					repository: '<temporary run repository>'
				},
				output
			}
		]
	);
});

test('Throws SyntaxError for invalid benchmark JSON', async () => {
	const output = await withTempDir('benchmark-invalid-', async (directory) => {
		const path = join(directory, 'benchmark.json');
		writeFileSync(path, '{ invalid');
		try {
			await runBenchmark({
				path,
				runners: fixtureRunners(),
				repository: new BenchmarkRepository(join(directory, 'runs')),
				signal: new AbortController().signal
			});
			return { error: 'did not reject' };
		} catch (error) {
			return { error: error instanceof SyntaxError ? error.name : 'unexpected error' };
		}
	});
	expect(output).toEqual({ error: 'SyntaxError' });
	recordExampleCases(
		{
			unitId: 'workflow.run-benchmark',
			symbol: 'runBenchmark',
			state: 'throws-syntaxerror-for-invalid-benchmark-json',
			evidence: 'examples-cases',
			file: 'throws-syntaxerror-for-invalid-benchmark-json.json'
		},
		[
			{
				name: 'Rejects malformed definition JSON before validation',
				input: { path: '<temporary invalid benchmark.json>' },
				output
			}
		]
	);
});
