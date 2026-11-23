import { Command } from 'commander';
import { test, vi } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { registerUnitsGuidance } from '../../src/cli/program/unitsGuidance';
import { guideUnits } from '../../src/workflows/development-tooling/guide-units/guideUnits';

vi.mock('../../src/workflows/development-tooling/guide-units/guideUnits', () => ({
	guideUnits: vi.fn(),
	renderUnitsGuide: vi.fn()
}));

vi.mock('../../src/workflows/development-tooling/guide-units/checkUnitContracts', () => ({
	checkUnitContracts: vi.fn(),
	renderContractCheck: vi.fn()
}));

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
		[
			{
				name: 'registers both commands and their CLI options',
				input: { parent: 'units' },
				output: commands
			}
		]
	);
});

test('Throws Error when the guide dependency fails', async () => {
	vi.mocked(guideUnits).mockRejectedValueOnce(new Error('guide dependency failed'));
	const program = new Command();
	const units = program.command('units');
	registerUnitsGuidance(units);
	let caught: unknown;
	try {
		await program.parseAsync(['units', 'guide', 'entry.program-units-guidance'], { from: 'user' });
	} catch (error) {
		caught = error;
	}
	expect(caught).toMatchObject({ name: 'Error', message: 'guide dependency failed' });
	recordExampleCases(
		{
			unitId: 'entry.program-units-guidance',
			symbol: 'registerUnitsGuidance',
			state: 'throws-error-when-the-guide-dependency-fails',
			evidence: 'examples-cases',
			file: 'throws-error-when-the-guide-dependency-fails.json'
		},
		[
			{
				name: 'propagates the guide dependency failure',
				input: { command: 'units guide entry.program-units-guidance' },
				error: { name: 'Error', message: 'guide dependency failed' }
			}
		]
	);
});
