import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { buildProgram } from '../../src/cli/program';

test('Builds the harness command program', () => {
	const program = buildProgram();
	const output = {
		name: program.name(),
		description: program.description(),
		version: program.version(),
		commands: program.commands.map((command) => command.name())
	};

	expect(output.name).toBe('harness');
	expect(output.description).toBe(
		'Opinionated Rails-inspired coding harnesses for humans and agents.'
	);
	expect(output.version).toBeTruthy();
	expect(output.commands.length).toBeGreaterThan(0);

	recordExampleCases(
		{
			unitId: 'entry.program',
			symbol: 'buildProgram',
			state: 'builds-the-harness-command-program',
			evidence: 'examples-cases',
			file: 'builds-the-harness-command-program.json'
		},
		[{ name: 'builds a named command with registered subcommands', input: {}, output }]
	);
});
