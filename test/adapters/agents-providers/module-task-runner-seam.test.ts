import { ModuleTaskRunnerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskRunnerAdapter';
import { expect } from '../../verificationExpect';
import { expectTypeOf, test } from 'vitest';
import type { TaskProcessExecutor } from '../../../src/adapters/agents-providers/ModuleTaskRunnerAdapter.types';
import type { Seam } from './module-task-runner.test.types';

// Compile-time only, so it stays outside the module-tasks scenario, whose checks need runtime matchers.
test('the process executor seam is typed, never unknown or any', () => {
	expectTypeOf<Seam>().toEqualTypeOf<TaskProcessExecutor | undefined>();
});

test.each([
	['usage_limit_reached', true],
	['rate_limit_exceeded', true],
	['invalid_api_key', false],
	["You've hit your usage limit. Try again later.", true]
] as const)('Codex failure classifies provider quota %s', async (code, quotaRejected) => {
	const runner = new ModuleTaskRunnerAdapter(async () => ({
		code: 1,
		stdout: JSON.stringify({
			type: 'turn.failed',
			error: code.includes(' ') ? { message: code } : { code }
		})
	}));
	await expect(
		runner.run({
			provider: 'codex',
			model: 'gpt-6-luna',
			intelligence: 'medium',
			cwd: '.',
			prompt: 'Goal',
			signal: new AbortController().signal
		})
	).rejects.toMatchObject({ quotaRejected });
});
