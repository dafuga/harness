import { expect, test } from 'vitest';
import { ModuleTaskRunnerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskRunnerAdapter';
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
