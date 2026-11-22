import type { GatewayOptions } from './function.gateway-options.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { gatewayOptions } from '../../src/cli/program/codex-gateway-service/claude-query-service/gatewayOptions';

const HOME_ENV = { HOME: '/workspace/user', PATH: '/usr/local/bin:/usr/bin:/bin', SHELL: '/bin/zsh' };
const DEFAULT_ENV = {
	...HOME_ENV,
	ANTHROPIC_API_KEY: 'fixture-api-key',
	CLAUDE_CODE_USE_BEDROCK: '1',
	CLAUDE_CODE_OAUTH_TOKEN: 'fixture-oauth-token'
};
const OVERRIDE_ENV = {
	HOME: '/workspace/user',
	PATH: '/usr/bin:/bin',
	HARNESS_CLAUDE_EXECUTABLE: '/workspace/tools/claude/bin/claude',
	ANTHROPIC_BASE_URL: 'https://fixture.invalid',
	CLAUDE_CODE_USE_VERTEX: '1'
};

function makeSession(controller: AbortController) {
	return {
		id: 'fixture-session-1',
		controller,
		pending: new Map(),
		delivered: new Set<string>(),
		running: false,
		replays: new Map<string, string>()
	};
}

function buildWithEnvironment(
	values: Record<string, string>,
	controller: AbortController
): GatewayOptions {
	const saved = { ...process.env };
	for (const key of Object.keys(process.env)) delete process.env[key];
	Object.assign(process.env, values);
	try {
		return gatewayOptions(makeSession(controller));
	} finally {
		for (const key of Object.keys(process.env)) delete process.env[key];
		Object.assign(process.env, saved);
	}
}

function summarise(options: GatewayOptions) {
	return {
		env: options.env,
		tools: options.tools,
		settingSources: options.settingSources,
		persistSession: options.persistSession,
		includePartialMessages: options.includePartialMessages,
		model: options.model,
		effort: options.effort,
		permissionMode: options.permissionMode,
		cwd: options.cwd,
		pathToClaudeCodeExecutable: options.pathToClaudeCodeExecutable,
		extraArgs: options.extraArgs
	};
}

test('Builds gateway options with the default claude executable', () => {
	const controller = new AbortController();
	const options = buildWithEnvironment(DEFAULT_ENV, controller);
	const summary = summarise(options);

	expect(summary).toEqual({
		env: HOME_ENV,
		tools: [],
		settingSources: [],
		persistSession: false,
		includePartialMessages: true,
		model: 'claude-opus-5-5',
		effort: 'xhigh',
		permissionMode: 'dontAsk',
		cwd: '/tmp',
		pathToClaudeCodeExecutable: '/workspace/user/.local/bin/claude',
		extraArgs: { 'strict-mcp-config': null, 'no-chrome': null }
	});
	expect(options.abortController).toBe(controller);
	controller.abort();
	expect(options.abortController?.signal.aborted).toBe(true);
	recordExampleCases(
		{
			unitId: 'function.gateway-options',
			symbol: 'gatewayOptions',
			state: 'builds-gateway-options-with-the-default-claude-executable',
			evidence: 'examples-cases',
			file: 'builds-gateway-options-with-the-default-claude-executable.json'
		},
		[
			{
				name: 'env has provider variables and OAuth token, no HARNESS override',
				input: { env: DEFAULT_ENV },
				output: summary
			}
		]
	);
});

test('Uses the HARNESS executable override', () => {
	const controller = new AbortController();
	const options = buildWithEnvironment(OVERRIDE_ENV, controller);
	const summary = summarise(options);

	expect(options.pathToClaudeCodeExecutable).toBe('/workspace/tools/claude/bin/claude');
	expect(options.env).toEqual({
		HOME: '/workspace/user',
		PATH: '/usr/bin:/bin',
		HARNESS_CLAUDE_EXECUTABLE: '/workspace/tools/claude/bin/claude'
	});
	expect(options.persistSession).toBe(false);
	expect(options.permissionMode).toBe('dontAsk');
	recordExampleCases(
		{
			unitId: 'function.gateway-options',
			symbol: 'gatewayOptions',
			state: 'uses-the-harness-executable-override',
			evidence: 'examples-cases',
			file: 'uses-the-harness-executable-override.json'
		},
		[
			{
				name: 'HARNESS_CLAUDE_EXECUTABLE is used and ANTHROPIC_ and CLAUDE_CODE_USE_ keys are removed',
				input: { env: OVERRIDE_ENV },
				output: summary
			}
		]
	);
});
