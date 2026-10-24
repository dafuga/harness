import { expect, test } from 'vitest';
import { buildProgram } from '../../../src/cli/program';
import { measureWorkload } from '../../support/measureWorkload';
test('module task commands retain the existing evidence-based task check', () =>
	measureWorkload('command.agents-providers-module-task', 'module-task-command-discovery', () => {
		const task = buildProgram().commands.find((c) => c.name() === 'task')!;
		expect(
			task.commands.map((c) => c.name()),
			'module task commands must be discoverable'
		).toEqual(
			expect.arrayContaining([
				'check',
				'feature',
				'add',
				'show',
				'list',
				'prompt',
				'worker',
				'retry',
				'review',
				'sync'
			])
		);
		expect(task.commands.find((c) => c.name() === 'add')!.options.map((o) => o.long)).toEqual(
			expect.arrayContaining(['--input', '--model', '--intelligence', '--assignee'])
		);
	}));
