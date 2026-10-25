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
