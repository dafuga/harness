import { expect, test } from 'vitest';
import { buildProgram } from '../../../src/cli/program';
test('module task commands retain the existing evidence-based task check', () => {
	const task = buildProgram().commands.find((c) => c.name() === 'task')!;
	expect(task.commands.map((c) => c.name())).toEqual(
		expect.arrayContaining([
			'check',
			'feature',
			'add',
			'show',
			'list',
			'prompt',
			'worker',
			'retry',
			'sync'
		])
	);
	expect(task.commands.find((c) => c.name() === 'add')!.options.map((o) => o.long)).toEqual(
		expect.arrayContaining(['--input', '--model', '--intelligence', '--assignee'])
	);
});
