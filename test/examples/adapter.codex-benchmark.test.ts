import { test } from 'vitest';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CodexBenchmarkAdapter } from '../../src/cli/program/benchmark-service/benchmark-definition/CodexBenchmarkAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

function codexCandidate(
	effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max' = 'medium',
	model = 'gpt-6-luna',
	tools: 'default' | 'files' = 'default'
) {
	return {
		id: 'codex-luna-medium',
		runner: 'codex' as const,
		model,
		effort,
		instructions: 'Prefer a focused implementation that satisfies the benchmark task.',
		tools
	};
}

function installCodexFixture(directory: string): string {
	const executable = join(directory, 'fixture-codex');
	writeFileSync(
		executable,
		[
			'#!/usr/bin/env node',
			"const args = process.argv.slice(2);",
			"if (args[0] === '--version') {",
			"  process.stdout.write('codex fixture 1.0.0\\n');",
			'} else {',
			"  const resumeAt = args.indexOf('resume');",
			"  const session = resumeAt === -1 ? 'fixture-session-42' : args[resumeAt + 1];",
			"  const model = resumeAt === -1 ? 'gpt-6-luna' : undefined;",
			'  const events = [',
			"    { type: 'thread.started', thread_id: session },",
			'    { type: \'turn.completed\', ...(model ? { model } : {}), usage: { input_tokens: 1842, output_tokens: 317, cached_input_tokens: 512 } }',
			'  ];',
			"  process.stdout.write(events.map((event) => JSON.stringify(event)).join('\\n') + '\\n');",
			'}'
		].join('\n') + '\n'
	);
	chmodSync(executable, 0o700);
	return executable;
}

async function rejectionMessage<T>(promise: Promise<T>): Promise<string> {
	return promise.then(
		() => 'Unexpectedly resolved.',
		(error: unknown) => (error instanceof Error ? error.message : String(error))
	);
}

function exampleInput(
	input: {
		candidate: ReturnType<typeof codexCandidate>;
		cwd: string;
		prompt: string;
		session?: string;
	},
	cwd = input.cwd
) {
	return {
		candidate: input.candidate,
		cwd,
		prompt: input.prompt,
		...(input.session ? { session: input.session } : {}),
		signal: { aborted: false }
	};
}

function recordExamples(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
): void {
	recordExampleCases(
		{
			unitId: 'adapter.codex-benchmark', symbol, state, evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Preflight returns the Codex version.', async () => {
	await withTempDir('codex-benchmark-examples-', async (directory) => {
		const adapter = new CodexBenchmarkAdapter(installCodexFixture(directory));
		const candidate = codexCandidate();
		const output = await adapter.preflight(candidate);
		const unsupported = { ...codexCandidate('max'), id: 'codex-luna-max' };
		const unsupportedError = await rejectionMessage(adapter.preflight(unsupported));

		expect(output).toBe('codex fixture 1.0.0');
		expect(unsupportedError).toBe('Unsupported Codex tool or effort setting.');
		recordExamples('CodexBenchmarkAdapter.preflight', 'preflight-returns-the-codex-version', [
			{
				name: 'supported candidate returns the fake Codex version',
				input: { candidate },
				output
			},
			{
				name: 'max effort is rejected before launching Codex',
				input: { candidate: unsupported },
				error: unsupportedError
			}
		]);
	});
}, 20000);

test('Run parses Codex completed-turn events.', async () => {
	await withTempDir('codex-benchmark-examples-', async (directory) => {
		const cwd = join(directory, 'workspace');
		mkdirSync(cwd);
		const adapter = new CodexBenchmarkAdapter(installCodexFixture(directory));
		const input = {
			candidate: codexCandidate(),
			cwd,
			prompt: 'Implement the requested change in the isolated workspace.',
			signal: new AbortController().signal
		};
		const output = await adapter.run(input);
		const resumedInput = { ...input, session: 'prior-session-17' };
		const resumedOutput = await adapter.run(resumedInput);
		const mismatchedInput = {
			...input,
			candidate: codexCandidate('medium', 'gpt-6-luna-preview')
		};
		const mismatchedError = await rejectionMessage(adapter.run(mismatchedInput));
		const usage = { inputTokens: 1842, outputTokens: 317, cacheReadTokens: 512 };

		expect(output).toEqual({
			session: 'fixture-session-42',
			reportedModel: 'gpt-6-luna',
			usage
		});
		expect(resumedOutput).toEqual({
			session: 'prior-session-17',
			reportedModel: undefined,
			usage
		});
		expect(mismatchedError).toBe('Codex reported a different model.');
		recordExamples('CodexBenchmarkAdapter.run', 'run-parses-codex-completed-turn-events', [
			{
				name: 'completed event reports the selected model and token usage',
				input: exampleInput(input, 'temporary benchmark workspace'),
				output
			},
			{
				name: 'resumed completed event may omit its reported model',
				input: exampleInput(resumedInput, 'temporary benchmark workspace'),
				output: { session: resumedOutput.session, usage: resumedOutput.usage }
			},
			{
				name: 'a reported model different from the candidate is rejected',
				input: exampleInput(mismatchedInput, 'temporary benchmark workspace'),
				error: mismatchedError
			}
		]);
	});
}, 20000);

test('Command builds fresh and resumed Codex argument vectors.', () => {
	const executable = '/usr/local/bin/codex';
	const adapter = new CodexBenchmarkAdapter(executable);
	const input = {
		candidate: codexCandidate(),
		cwd: '/workspace/component-value',
		prompt: 'Return the requested implementation.',
		signal: new AbortController().signal
	};
	const output = adapter.command(input);
	const resumedInput = { ...input, session: 'prior-session-17' };
	const resumedOutput = adapter.command(resumedInput);
	const expectedSettings = [
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

	expect(output).toEqual([
		executable,
		'exec',
		'--sandbox',
		'workspace-write',
		...expectedSettings
	]);
	expect(resumedOutput).toEqual([
		executable,
		'exec',
		'resume',
		'prior-session-17',
		...expectedSettings
	]);
	recordExamples('CodexBenchmarkAdapter.command', 'command-builds-fresh-and-resumed-codex-argument-vectors', [
		{
			name: 'new session uses workspace-write and explicit execution settings',
			input: exampleInput(input),
			output
		},
		{
			name: 'existing session selects the resume command path',
			input: exampleInput(resumedInput),
			output: resumedOutput
		}
	]);
});
