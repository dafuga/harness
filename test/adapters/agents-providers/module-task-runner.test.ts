import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskRunnerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskRunnerAdapter';
import { observedTaskOperation } from '../../support/taskProfiles';
test('Claude and Codex launch exact models and intelligence without shell interpolation', () => {
	const runner = new ModuleTaskRunnerAdapter();
	expect(
		runner.command({ provider: 'claude', model: 'claude-haiku-5-5', intelligence: 'high' })
	).toEqual(expect.arrayContaining(['--model', 'claude-haiku-5-5', '--effort', 'high']));
	expect(runner.command({ provider: 'codex', model: 'gpt-6-luna', intelligence: 'max' })).toEqual(
		expect.arrayContaining([
			'-m',
			'gpt-6-luna',
			'model_reasoning_effort="max"',
			'model_provider="openai"'
		])
	);
});
test('successful public Claude CLI events retain requested model and summary', async () => {
	const runner = new ModuleTaskRunnerAdapter(async () => ({
		code: 0,
		stdout:
			'{"type":"system","subtype":"init","model":"claude-haiku-5-5"}\n{"type":"result","is_error":false,"result":"Implemented"}'
	}));
	const result = await observedTaskOperation(
		'adapter.agents-providers-module-task-runner',
		'parse-synthetic-cli-completion-only',
		() =>
			runner.run({
				provider: 'claude',
				model: 'claude-haiku-5-5',
				intelligence: 'medium',
				cwd: '.',
				prompt: 'Goal',
				signal: new AbortController().signal
			})
	);
	expect(result).toMatchObject({
		model: 'claude-haiku-5-5',
		reportedModel: 'claude-haiku-5-5',
		text: 'Implemented'
	});
});
test.each(['quota', 'authentication', 'text-only-quota'])(
	'fallback eligibility uses structured quota signals (%s)',
	async (kind) => {
		const events = [
			{
				type: 'result',
				is_error: true,
				result: kind === 'authentication' ? 'Authentication required' : 'Quota exhausted'
			}
		];
		if (kind === 'quota')
			events.unshift({
				type: 'rate_limit_event',
				rate_limit_info: { status: 'rejected' }
			} as never);
		const runner = new ModuleTaskRunnerAdapter(async () => ({
			code: 1,
			stdout: events.map((e) => JSON.stringify(e)).join('\n')
		}));
		await expect(
			runner.run({
				provider: 'claude',
				model: 'claude-haiku-5-5',
				intelligence: 'medium',
				cwd: '.',
				prompt: 'Goal',
				signal: new AbortController().signal
			})
		).rejects.toMatchObject({ quotaRejected: kind === 'quota' });
	}
);
test('a completed CLI run that reports another model is rejected', async () => {
	const runner = new ModuleTaskRunnerAdapter(async () => ({
		code: 0,
		stdout:
			'{"type":"system","subtype":"init","model":"claude-sonnet-5-5"}\n{"type":"result","is_error":false,"result":"Done"}'
	}));
	await expect(
		runner.run({
			provider: 'claude',
			model: 'claude-haiku-5-5',
			intelligence: 'medium',
			cwd: '.',
			prompt: 'Goal',
			signal: new AbortController().signal
		})
	).rejects.toThrow('different model');
});
test.each(['claude', 'codex'] as const)(
	'public %s usage is retained without guessing absent counters',
	async (provider) => {
		const model = provider === 'claude' ? 'claude-haiku-5-5' : 'gpt-6-luna';
		const events =
			provider === 'claude'
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
					];
		const runner = new ModuleTaskRunnerAdapter(async () => ({
			code: 0,
			stdout: events.map((e) => JSON.stringify(e)).join('\n')
		}));
		const result = await runner.run({
			provider,
			model,
			intelligence: 'medium',
			cwd: '.',
			prompt: 'Goal',
			signal: new AbortController().signal
		});
		expect(result).toMatchObject({
			usage: {
				inputTokens: 35,
				outputTokens: 4,
				cacheReadTokens: 10,
				cacheWriteTokens: provider === 'claude' ? 20 : null,
				reportedCostUsd: provider === 'claude' ? 0.02 : null
			}
		});
	}
);
test('failed turns preserve available usage for cost attribution', async () => {
	const runner = new ModuleTaskRunnerAdapter(async () => ({
		code: 1,
		stdout: JSON.stringify({
			type: 'result',
			is_error: true,
			usage: {
				input_tokens: 7,
				output_tokens: 2,
				cache_read_input_tokens: 0,
				cache_creation_input_tokens: 0
			},
			total_cost_usd: 0.01
		})
	}));
	await expect(
		runner.run({
			provider: 'claude',
			model: 'claude-haiku-5-5',
			intelligence: 'medium',
			cwd: '.',
			prompt: 'Goal',
			signal: new AbortController().signal
		})
	).rejects.toMatchObject({ usage: { inputTokens: 7, outputTokens: 2, reportedCostUsd: 0.01 } });
});
const codexInput = () => ({
	provider: 'codex' as const,
	model: 'gpt-6-luna',
	intelligence: 'max' as const,
	cwd: '.',
	prompt: 'Goal',
	signal: new AbortController().signal
});
const runCodexFailure = (stdout: string, stderr: string) =>
	new ModuleTaskRunnerAdapter(async () => ({ code: 1, stdout, stderr })).run(codexInput());
const privateDiagnostic = 'sk-test-provider-secret https://provider.invalid';
const codexError = (message: string) => JSON.stringify({ type: 'error', message });
const failedTurn = (message: string) => JSON.stringify({ type: 'turn.failed', error: { message } });
const modelUnavailable = 'gpt-6-luna unavailable; request model access';
const stderr = {
	authentication: `Run codex login; ${privateDiagnostic}/auth`,
	modelAccess: `${privateDiagnostic}/model`,
	permission: `Grant workspace read permission; ${privateDiagnostic}/permission`
};
const nextStep = {
	authentication: /codex login/i,
	modelAccess: /request model access/i,
	permission: /grant workspace read permission/i,
	malformed: /invalid response/i,
	unknown: /^Codex task failed; inspect CLI authentication, permissions or model access\.$/
};

test.each([
	['auth', codexError('Authentication required'), stderr.authentication, nextStep.authentication],
	['model', failedTurn(modelUnavailable), stderr.modelAccess, nextStep.modelAccess],
	['permission', failedTurn('Permission denied'), stderr.permission, nextStep.permission],
	['malformed', `{invalid ${privateDiagnostic}/error`, '', nextStep.malformed],
	['unknown', codexError('Unexpected provider failure'), '', nextStep.unknown]
] as const)(
	'Codex %s failures are safe and actionable without quota fallback',
	async (_, stdout, stderr, nextStep) => {
		const failure = runCodexFailure(stdout, stderr);
		await expect(failure).rejects.toMatchObject({ quotaRejected: false });
		await expect(failure).rejects.toThrow(nextStep);
		await expect(failure).rejects.not.toThrow(/sk-test-provider-secret|provider\.invalid/i);
	}
);

test('Codex execute rejection remains distinct from a provider failure', async () => {
	const spawnError = new Error('Codex process could not be spawned');
	const runner = new ModuleTaskRunnerAdapter(async () => {
		throw spawnError;
	});
	await expect(runner.run(codexInput())).rejects.toThrow(spawnError.message);
});
