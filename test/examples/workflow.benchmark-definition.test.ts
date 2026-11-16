import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import {
	benchmarkRunners,
	prepareBenchmark
} from '../../src/cli/program/benchmark-service/benchmarkDefinition';
import type { BenchmarkRunners } from '../../src/cli/program/benchmark-service/benchmarkDefinition';

type Repository = Parameters<Parameters<typeof withTempRepo>[0]>[0];
type Cases = Parameters<typeof recordExampleCases>[1];

const unitId = 'workflow.benchmark-definition';
const identity = ['-c', 'user.name=Benchmark Fixture', '-c', 'user.email=fixture@example.invalid'];

function record(symbol: string, state: string, cases: Cases): void {
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

function commitSource(repository: Repository): string {
	mkdirSync(join(repository.root, 'src'), { recursive: true });
	writeFileSync(join(repository.root, 'src', 'a.ts'), 'export const a = 1;\n');
	repository.git('add', '.');
	repository.git(...identity, 'commit', '-m', 'Add source');
	return repository.git('rev-parse', 'HEAD').trim();
}

function definitionFor(project: string) {
	return {
		version: 1,
		name: 'evidence-grid-empty-state',
		project,
		revision: 'HEAD',
		task: 'Show an empty-state message in the evidence grid when no rows match the filter.',
		contract: 'The grid renders the empty-state text and keeps the filter controls visible.',
		allowedFiles: ['src/a.ts'],
		checks: [{ id: 'unit-tests', command: 'npm test -- EvidenceGrid' }],
		setup: ['npm ci'],
		candidates: [
			{
				id: 'claude-sonnet',
				runner: 'claude',
				model: 'claude-sonnet-5-5',
				effort: 'medium',
				instructions: '',
				tools: 'files'
			},
			{
				id: 'codex-high',
				runner: 'codex',
				model: 'gpt-5-codex',
				effort: 'high',
				instructions: 'Keep edits inside the allowed files.',
				tools: 'default'
			}
		],
		budget: { repetitions: 3, timeoutMs: 900000, repairs: 2 }
	};
}

function writeDefinition(directory: string, body: unknown): string {
	mkdirSync(directory, { recursive: true });
	const path = join(directory, 'definition.json');
	writeFileSync(path, JSON.stringify(body));
	return path;
}

function runnerStub(preflight: () => Promise<string>) {
	return {
		preflight,
		run: () => Promise.reject(new Error('run is not called by prepareBenchmark'))
	};
}

function fakeRunners(claude: () => Promise<string>): BenchmarkRunners {
	return {
		codex: runnerStub(() => Promise.resolve('codex-cli 0.50.0')),
		claude: runnerStub(claude)
	};
}

async function rejectionOf(work: () => Promise<unknown>): Promise<Error> {
	try {
		await work();
	} catch (caught) {
		return caught as Error;
	}
	throw new Error('Expected the promise to reject.');
}

test('Resolves a valid definition to its pinned commit', async () => {
	await withTempRepo(async (repository) => {
		const revision = commitSource(repository);
		const path = writeDefinition(join(repository.root, 'benchmarks'), definitionFor('..'));
		const runners = fakeRunners(() => Promise.resolve('2.0.0 (Claude Code)'));
		const prepared = await prepareBenchmark(path, runners);

		expect(prepared.revision).toBe(revision);
		expect(prepared.project).toBe(realpathSync(repository.root));
		expect(prepared.runnerVersions).toEqual({
			'claude-sonnet': '2.0.0 (Claude Code)',
			'codex-high': 'codex-cli 0.50.0'
		});
		expect(prepared.trials).toBe(6);
		expect(prepared.fingerprint).toMatch(/^[0-9a-f]{64}$/);
		record('prepareBenchmark', 'resolves-a-valid-definition-to-its-pinned-commit', [
			{
				name: 'two candidates with three repetitions pin HEAD and count six trials',
				input: { project: '..', revision: 'HEAD', candidates: 2, repetitions: 3 },
				output: {
					revisionLength: prepared.revision.length,
					runnerVersions: prepared.runnerVersions,
					trials: prepared.trials,
					fingerprintLength: prepared.fingerprint.length
				}
			}
		]);
	});
});

test('Rejects a project that is not the Git repository root', async () => {
	await withTempRepo(async (repository) => {
		commitSource(repository);
		const path = writeDefinition(join(repository.root, 'src'), definitionFor('.'));
		const runners = fakeRunners(() => Promise.resolve('2.0.0 (Claude Code)'));
		const error = await rejectionOf(() => prepareBenchmark(path, runners));

		expect(error).toBeInstanceOf(Error);
		expect(error.message).toBe('Benchmark project must be the Git repository root.');
		record('prepareBenchmark', 'rejects-a-project-that-is-not-the-git-repository-root', [
			{
				name: 'project directory inside the repository is rejected',
				input: { project: '.', definitionDirectory: 'src' },
				error: { name: error.name, message: error.message }
			}
		]);
	});
});

test('Rejects when a runner preflight fails', async () => {
	await withTempRepo(async (repository) => {
		commitSource(repository);
		const path = writeDefinition(join(repository.root, 'benchmarks'), definitionFor('..'));
		const runners = fakeRunners(() => Promise.reject(new Error('Claude runner is unavailable.')));
		const error = await rejectionOf(() => prepareBenchmark(path, runners));

		expect(error.message).toBe('Claude runner is unavailable.');
		record('prepareBenchmark', 'rejects-when-a-runner-preflight-fails', [
			{
				name: 'claude preflight rejection propagates unchanged',
				input: { runner: 'claude', candidate: 'claude-sonnet' },
				error: { name: error.name, message: error.message }
			}
		]);
	});
});

test('Creates fresh native runner adapters for codex and claude', () => {
	const first = benchmarkRunners();
	const second = benchmarkRunners();

	expect(Object.keys(first).sort()).toEqual(['claude', 'codex']);
	expect(first.codex).not.toBe(second.codex);
	expect(first.claude).not.toBe(second.claude);
	record('benchmarkRunners', 'creates-fresh-native-runner-adapters-for-codex-and-claude', [
		{
			name: 'two calls return distinct codex and claude adapters',
			input: {},
			output: { keys: Object.keys(first).sort(), distinctInstances: true }
		}
	]);
});
