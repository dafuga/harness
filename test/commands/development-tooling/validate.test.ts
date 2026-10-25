import { expect, test } from 'vitest';
import { buildProgram } from '../../../src/cli/program';

test('validation is a discoverable command with module, type and historical scopes', () => {
	const command = buildProgram().commands.find((item) => item.name() === 'validate');
	expect(command, 'A first-class validate command is required').toBeDefined();
	expect(command!.options.map((item) => item.long)).toEqual(
		expect.arrayContaining([
			'--module',
			'--type',
			'--commit',
			'--history',
			'--write',
			'--refresh',
			'--json',
			'--sync'
		])
	);
});
