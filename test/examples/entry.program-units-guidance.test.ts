import { Command } from 'commander';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { registerUnitsGuidance } from '../../src/cli/program/unitsGuidance';

test('Registers guide and contract review commands', () => {
	const units = new Command('units');
	registerUnitsGuidance(units);
	const commands = units.commands.map((command) => ({
		name: command.name(),
		description: command.description(),
		options: command.options.map((option) => option.long)
	}));
	expect(commands.map((command) => command.name)).toEqual(['guide', 'check-contract']);
	recordExampleCases(
		{
			unitId: 'entry.program-units-guidance',
			symbol: 'registerUnitsGuidance',
			state: 'registers-guide-and-contract-review-commands',
			evidence: 'examples-cases',
			file: 'registers-guide-and-contract-review-commands.json'
		},
		[{ name: 'registers both commands and their CLI options', input: { parent: 'units' }, output: commands }]
	);
});
