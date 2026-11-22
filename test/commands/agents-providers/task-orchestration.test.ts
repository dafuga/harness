import { Command } from 'commander';
import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { TaskOrchestrationCommand } from '../../../src/commands/agents-providers/TaskOrchestrationCommand';

test('orchestration rejects context settings above the default before running a provider', async () => {
	const task = new Command('task').exitOverride().configureOutput({ writeErr: () => {} });
	new TaskOrchestrationCommand().register(task);
	await expect(
		task.parseAsync(
			[
				'orchestrate',
				'--tracker=pilot1',
				'--brief=brief.md',
				'--model=gpt-6.2-sol',
				'--context-tokens=150001'
			],
			{ from: 'user' }
		)
	).rejects.toMatchObject({ code: 'commander.invalidArgument' });
});
