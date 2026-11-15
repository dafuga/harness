import { afterEach, test } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClaudeBenchmarkAdapter } from '../../src/cli/program/benchmark-service/benchmark-definition/ClaudeBenchmarkAdapter';
import { benchmarkFixtureDefinition } from '../support/benchmark';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const owned: string[] = [];

afterEach(() => {
	for (const directory of owned.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function temporaryDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), 'claude-benchmark-examples-'));
	owned.push(directory);
	return directory;
}

function claudeCandidate(tools: 'default' | 'files' = 'files') {
	return {
		...benchmarkFixtureDefinition().candidates[0],
		runner: 'claude' as const,
		tools
	};
}

function installClaudeFixture(directory: string): string {
	const executable = join(directory, 'claude');
	writeFileSync(
		executable,
		`#!/usr/bin/env bun
console.log(JSON.stringify({ type: 'system', subtype: 'init', model: 'explicit-model' }));
console.log(JSON.stringify({
	type: 'result', subtype: 'success', session_id: 'fixture-session-42', total_cost_usd: 0.003,
	usage: { input_tokens: 21, output_tokens: 8, cache_read_input_tokens: 5 }
}));
`
	);
	chmodSync(executable, 0o700);
	return executable;
}

const expectedCommand = [
	'claude',
	'-p',
	'--output-format',
	'stream-json',
	'--verbose',
	'--model',
	'explicit-model',
	'--effort',
	'medium',
	'--permission-mode',
	'bypassPermissions',
	'--safe-mode',
	'--setting-sources',
	'',
	'--strict-mcp-config',
	'--mcp-config',
	'{"mcpServers":{}}',
	'--tools',
	'Read,Edit,Write,Glob,Grep',
	'--resume',
	'prior-session-17'
];

test('Command returns Claude arguments for file tools and resuming a prior session.', () => {
	const cwd = temporaryDirectory();
	const input = {
		candidate: claudeCandidate(),
		cwd,
		prompt: 'Update the allowed file to return the requested value.',
		session: 'prior-session-17',
		signal: new AbortController().signal
	};
	const output = new ClaudeBenchmarkAdapter().command(input);
	expect(output).toEqual(expectedCommand);
	recordExampleCases(
		{
			unitId: 'adapter.claude-benchmark',
			symbol: 'ClaudeBenchmarkAdapter.command',
			state: 'builds-command',
			evidence: 'examples-cases',
			file: 'builds-command.json'
		},
		[
			{
				name: 'file tools resume a prior session',
				input: {
					candidate: input.candidate,
					cwd,
					prompt: input.prompt,
					session: input.session,
					signal: { aborted: false }
				},
				output
			}
		]
	);
});

test("Run returns the completed session and usage from Claude's event stream.", async () => {
	const directory = temporaryDirectory();
	const cwd = join(directory, 'workspace');
	mkdirSync(cwd);
	const executable = installClaudeFixture(directory);
	const input = {
		candidate: claudeCandidate('default'),
		cwd,
		prompt: 'Return the requested value in the isolated workspace.',
		signal: new AbortController().signal
	};
	const output = await new ClaudeBenchmarkAdapter(executable).run(input);
	expect(output).toEqual({
		session: 'fixture-session-42',
		reportedModel: 'explicit-model',
		usage: {
			inputTokens: 21,
			outputTokens: 8,
			cacheReadTokens: 5,
			reportedCostUsd: 0.003
		}
	});
	recordExampleCases(
		{
			unitId: 'adapter.claude-benchmark',
			symbol: 'ClaudeBenchmarkAdapter.run',
			state: 'runs-completed-turn',
			evidence: 'examples-cases',
			file: 'runs-completed-turn.json'
		},
		[
			{
				name: 'successful Claude event stream returns its session and usage',
				input: {
					candidate: input.candidate,
					cwd,
					prompt: input.prompt,
					signal: { aborted: false }
				},
				output
			}
		]
	);
});
