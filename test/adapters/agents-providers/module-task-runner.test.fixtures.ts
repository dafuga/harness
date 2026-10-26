import { vi } from 'vitest';
import { ModuleTaskRunnerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskRunnerAdapter';
import type {
	RunnerConstructorFixture,
	RunnerExecuteFixture,
	RunnerInputFixture,
	RunnerSandboxFixture,
	RunnerScopeFixture
} from './module-task-runner.test.types';

export const trustedScope: RunnerScopeFixture = {
	files: ['src/assigned.ts'],
	snapshot: '/tmp/harness-task-contracts.json',
	scratch: '/tmp/harness-task-scratch',
	readPaths: [process.execPath],
	protectedPaths: [`${process.cwd()}/.git`]
};
export const makeTaskInput = (
	provider: 'claude' | 'codex' = 'claude',
	model = 'claude-haiku-5-5',
	intelligence = 'medium',
	signal = new AbortController().signal
): RunnerInputFixture => ({
	provider,
	model,
	intelligence,
	cwd: process.cwd(),
	prompt: 'Goal',
	signal,
	scope: {
		...trustedScope,
		files: [...trustedScope.files],
		readPaths: [...trustedScope.readPaths],
		protectedPaths: [...trustedScope.protectedPaths]
	}
});
export const makeCodexInput = () => makeTaskInput('codex', 'gpt-6-luna', 'max');
export const makeIdentitySandbox = (
	env: NodeJS.ProcessEnv = { PATH: '/trusted/bin', HOME: '/tmp/harness-task-home' }
): RunnerSandboxFixture => ({
	prepare: async ({ argv, cwd }) => ({
		command: argv[0]!,
		args: argv.slice(1),
		cwd,
		env,
		cleanup: async () => undefined
	})
});
export const identitySandbox = makeIdentitySandbox();
export const runnerFor = (
	execute: RunnerExecuteFixture,
	sandbox: RunnerSandboxFixture = identitySandbox
) => {
	const Runner = ModuleTaskRunnerAdapter as unknown as RunnerConstructorFixture;
	return new Runner(execute, sandbox);
};
export const invokeRunner = (
	execute: RunnerExecuteFixture,
	input: RunnerInputFixture = makeTaskInput(),
	sandbox: RunnerSandboxFixture = identitySandbox
) => runnerFor(execute, sandbox).run(input);
export const claudeCompletion = (model = 'claude-haiku-5-5', text = 'Done') =>
	[
		{ type: 'system', subtype: 'init', model },
		{ type: 'result', is_error: false, result: text }
	]
		.map((event) => JSON.stringify(event))
		.join('\n');
export const claudeOtherModelCompletion = () => claudeCompletion('claude-sonnet-5-5');
export const usageEvents = (provider: 'claude' | 'codex', model: string) =>
	(provider === 'claude'
		? [
				{ type: 'system', subtype: 'init', model },
				{
					type: 'result',
					is_error: false,
					result: 'Done',
					total_cost_usd: 0.02,
					usage: {
						input_tokens: 5,
						output_tokens: 4,
						cache_read_input_tokens: 10,
						cache_creation_input_tokens: 20,
						cache_creation: { ephemeral_5m_input_tokens: 20, ephemeral_1h_input_tokens: 0 }
					}
				}
			]
		: [
				{
					type: 'turn.completed',
					model,
					usage: { input_tokens: 35, output_tokens: 4, cached_input_tokens: 10 }
				}
			]
	)
		.map((event) => JSON.stringify(event))
		.join('\n');
export const failedUsageEvent = () =>
	JSON.stringify({
		type: 'result',
		is_error: true,
		usage: {
			input_tokens: 7,
			output_tokens: 2,
			cache_read_input_tokens: 0,
			cache_creation_input_tokens: 0
		},
		total_cost_usd: 0.01
	});
export const fallbackEvent = (kind: string) =>
	[
		...(kind === 'quota'
			? [JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected' } })]
			: []),
		JSON.stringify({
			type: 'result',
			is_error: true,
			result: kind === 'authentication' ? 'Authentication required' : 'Quota exhausted'
		})
	].join('\n');
export const makeMissingScopeProbe = () => {
	const prepare = vi.fn(identitySandbox.prepare);
	const execute = vi.fn(async () => ({ code: 0, stdout: '' }));
	const input = makeTaskInput();
	input.scope = undefined;
	return {
		input,
		prepare,
		execute,
		run: runnerFor(execute, { ...identitySandbox, prepare }).run(input)
	};
};
export const makePrepareRejectionProbe = () => {
	const prepare = vi.fn(async () => {
		throw new Error('private /Users/daniel/.ssh/key sk-test-provider-secret');
	});
	const execute = vi.fn(async () => ({ code: 0, stdout: '' }));
	return {
		prepare,
		execute,
		run: runnerFor(execute, { ...identitySandbox, prepare }).run(makeTaskInput())
	};
};
export const makeWrapperProbe = () => {
	const cleanup = vi.fn(async () => undefined);
	const wrapper = {
		command: '/private/sandbox-launch',
		args: ['--policy', '/private/policy.sb'],
		cwd: '/private/policy-cwd',
		env: { PATH: '/trusted/bin', HOME: '/private/home' },
		cleanup
	};
	let providerArgv: string[] = [];
	const prepare = vi.fn(async (request: Parameters<RunnerSandboxFixture['prepare']>[0]) => {
		providerArgv = request.argv;
		return wrapper;
	});
	const execute: RunnerExecuteFixture = async () => ({
		code: 0,
		stdout: JSON.stringify({ type: 'turn.completed', model: 'gpt-6-luna' })
	});
	const executeSpy = vi.fn(execute);
	const input = makeCodexInput();
	const before = {
		...input,
		scope: {
			...input.scope!,
			files: [...input.scope!.files],
			readPaths: [...input.scope!.readPaths],
			protectedPaths: [...input.scope!.protectedPaths]
		}
	};
	const run = runnerFor(executeSpy, { prepare }).run(input);
	return {
		cleanup,
		wrapper,
		providerArgv: () => providerArgv,
		prepare,
		execute: executeSpy,
		input,
		before,
		run
	};
};
export const makeCleanupProbe = (outcome: 'resolve' | 'reject' | 'cancel') => {
	const cleanup = vi.fn(async () => undefined);
	const sandbox = makeIdentitySandbox();
	const prepare = vi.fn(async (request: Parameters<RunnerSandboxFixture['prepare']>[0]) => ({
		command: request.argv[0]!,
		args: request.argv.slice(1),
		cwd: request.cwd,
		env: { PATH: '/trusted/bin' },
		cleanup
	}));
	sandbox.prepare = prepare;
	const controller = new AbortController();
	const execute: RunnerExecuteFixture = async (_argv, _processInput) => {
		if (outcome === 'cancel') {
			controller.abort();
			throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
		}
		if (outcome === 'reject') throw new Error('synthetic process failure');
		return { code: 0, stdout: claudeCompletion() };
	};
	const executeSpy = vi.fn(execute);
	return {
		cleanup,
		execute: executeSpy,
		controller,
		run: runnerFor(executeSpy, sandbox).run(
			makeTaskInput('claude', 'claude-haiku-5-5', 'medium', controller.signal)
		)
	};
};
