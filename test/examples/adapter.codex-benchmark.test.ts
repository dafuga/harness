import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { CodexBenchmarkAdapter } from '../../src/cli/program/benchmark-service/benchmark-definition/CodexBenchmarkAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const state = (name: string) =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
const candidate = (
	effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max' = 'medium',
	model = 'gpt-6-luna',
	tools: 'default' | 'files' = 'default'
) => ({
	id: 'codex-luna-medium',
	runner: 'codex' as const,
	model,
	effort,
	instructions: 'Prefer a focused implementation that satisfies the benchmark task.',
	tools
});
function fixture(directory: string): string {
	const path = join(directory, 'fake-codex');
	writeFileSync(
		path,
		`#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === '--version') process.stdout.write(' codex fixture 1.0.0\\n');
else if (args[args.indexOf('-m') + 1] === 'fixture-fails') { process.stderr.write('failure'); process.exitCode = 1; }
else {
 const i = args.indexOf('resume'); const session = i < 0 ? 'fixture-session-42' : args[i + 1];
 const model = i < 0 ? 'gpt-6-luna' : undefined;
 const events = [{type:'thread.started',thread_id:session},{type:'turn.completed',...(model ? {model} : {}),usage:{input_tokens:1842,output_tokens:317,cached_input_tokens:512}}];
 process.stdout.write(events.map(JSON.stringify).join('\\n')+'\\n');
}`
	);
	chmodSync(path, 0o700);
	return path;
}
const message = <T>(promise: Promise<T>) =>
	promise.then(
		() => 'unexpected success',
		(error: unknown) => (error instanceof Error ? error.message : String(error))
	);
function record(
	symbol: string,
	title: string,
	cases: Parameters<typeof recordExampleCases>[1]
): void {
	const id = state(title);
	recordExampleCases(
		{
			unitId: 'adapter.codex-benchmark',
			symbol,
			state: id,
			evidence: 'examples-cases',
			file: `${id}.json`
		},
		cases
	);
}
function input(cwd: string, model = 'gpt-6-luna', session?: string) {
	return {
		candidate: candidate('medium', model),
		cwd,
		prompt: 'Implement the requested change.',
		...(session ? { session } : {}),
		signal: new AbortController().signal
	};
}

test('Preflight returns the Codex version.', async () =>
	withTempDir('codex-bench-', async (dir) => {
		const adapter = new CodexBenchmarkAdapter(fixture(dir));
		const settings = candidate();
		const output = await adapter.preflight(settings);
		expect(output).toBe('codex fixture 1.0.0');
		record('CodexBenchmarkAdapter.preflight', 'Preflight returns the Codex version.', [
			{
				name: 'supported candidate gets trimmed version output',
				input: { candidate: settings },
				output
			}
		]);
	}));

test('Throws Error when preflight settings are unsupported.', async () =>
	withTempDir('codex-bench-', async (dir) => {
		const settings = candidate('max');
		const error = await message(new CodexBenchmarkAdapter(fixture(dir)).preflight(settings));
		expect(error).toBe('Unsupported Codex tool or effort setting.');
		record(
			'CodexBenchmarkAdapter.preflight',
			'Throws Error when preflight settings are unsupported.',
			[{ name: 'max effort is rejected', input: { candidate: settings }, error }]
		);
	}));

test(
	'Run parses Codex completed-turn events.',
	async () =>
		withTempDir('codex-bench-', async (dir) => {
			const cwd = join(dir, 'workspace');
			mkdirSync(cwd);
			const adapter = new CodexBenchmarkAdapter(fixture(dir));
			const request = input(cwd);
			const output = await adapter.run(request);
			const resumed = input(cwd, 'gpt-6-luna', 'prior-session-17');
			const resumedOutput = await adapter.run(resumed);
			expect(output).toEqual({
				session: 'fixture-session-42',
				reportedModel: 'gpt-6-luna',
				usage: { inputTokens: 1842, outputTokens: 317, cacheReadTokens: 512 }
			});
			record('CodexBenchmarkAdapter.run', 'Run parses Codex completed-turn events.', [
				{
					name: 'completed turn includes model and usage',
					input: { ...request, cwd: 'temporary benchmark workspace' },
					output
				},
				{
					name: 'resumed turn can omit reported model',
					input: { ...resumed, cwd: 'temporary benchmark workspace' },
					output: { session: resumedOutput.session, usage: resumedOutput.usage }
				}
			]);
		}),
	20000
);

test(
	'Throws CodexRunError when the Codex process fails.',
	async () =>
		withTempDir('codex-bench-', async (dir) => {
			const cwd = join(dir, 'workspace');
			mkdirSync(cwd);
			const request = input(cwd, 'fixture-fails');
			const error = await message(new CodexBenchmarkAdapter(fixture(dir)).run(request));
			expect(error).toBe(
				'Codex runner failed; inspect authentication, model access, and local runner availability.'
			);
			record('CodexBenchmarkAdapter.run', 'Throws CodexRunError when the Codex process fails.', [
				{
					name: 'nonzero process exit reports runner failure',
					input: { ...request, cwd: 'temporary benchmark workspace' },
					error
				}
			]);
		}),
	20000
);

test(
	'Throws CodexRunError when Codex reports a different model.',
	async () =>
		withTempDir('codex-bench-', async (dir) => {
			const cwd = join(dir, 'workspace');
			mkdirSync(cwd);
			const request = input(cwd, 'gpt-6-luna-preview');
			const error = await message(new CodexBenchmarkAdapter(fixture(dir)).run(request));
			expect(error).toBe('Codex reported a different model.');
			record(
				'CodexBenchmarkAdapter.run',
				'Throws CodexRunError when Codex reports a different model.',
				[
					{
						name: 'truthy reported model must match candidate',
						input: { ...request, cwd: 'temporary benchmark workspace' },
						error
					}
				]
			);
		}),
	20000
);

test('Command builds fresh and resumed Codex argument vectors.', () => {
	const executable = '/usr/local/bin/codex';
	const adapter = new CodexBenchmarkAdapter(executable);
	const request = input('/workspace/component-value');
	const fresh = adapter.command(request);
	const resumedRequest = { ...request, session: 'prior-session-17' };
	const resumed = adapter.command(resumedRequest);
	const settings = [
		'--json',
		'--ignore-user-config',
		'-m',
		'gpt-6-luna',
		'-c',
		'model_reasoning_effort="medium"',
		'-c',
		'approval_policy="never"',
		'-c',
		'model_provider="openai"',
		'-'
	];
	expect(fresh).toEqual([executable, 'exec', '--sandbox', 'workspace-write', ...settings]);
	record(
		'CodexBenchmarkAdapter.command',
		'Command builds fresh and resumed Codex argument vectors.',
		[
			{ name: 'fresh run uses workspace sandbox', input: request, output: fresh },
			{ name: 'existing session selects resume path', input: resumedRequest, output: resumed }
		]
	);
});
