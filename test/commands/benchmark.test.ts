import { expect, test } from 'vitest';
import { buildProgram } from '../../src/cli/program';

test('benchmark exposes validate, run and results', () => {
	const command = buildProgram().commands.find((entry) => entry.name() === 'benchmark');
	expect(command?.commands.map((entry) => entry.name())).toEqual(['validate', 'run', 'results']);
});
