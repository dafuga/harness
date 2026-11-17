import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { loadCliProgram } from '../../src/cli/loadCliProgram';

type ProgramSummary = { name: string; version: string | null; commands: string[] };

async function summarise(args: readonly string[]): Promise<ProgramSummary> {
	const program = await loadCliProgram(args);
	return {
		name: program.name(),
		version: program.version() ?? null,
		commands: program.commands.map((command) => command.name())
	};
}

test('Registers the selected family with root help placeholders', async () => {
	const units = await summarise(['units']);
	const impact = await summarise(['help', 'impact']);
	const none = await summarise([]);

	expect(units.name).toBe('harness');
	expect(units.version).toMatch(/\S/);
	expect(units.commands).toContain('units');
	expect(impact.commands).toContain('impact');
	expect(none.commands.length).toBeGreaterThan(0);
	expect(units.commands).toContain('impact');
	expect(none.commands).toContain('units');

	recordExampleCases(
		{
			unitId: 'entry.load-cli-program',
			symbol: 'loadCliProgram',
			state: 'registers-the-selected-family-with-root-help-placeholders',
			evidence: 'examples-cases',
			file: 'registers-the-selected-family-with-root-help-placeholders.json'
		},
		[
			{ name: 'units token loads the units family', input: ['units'], output: units },
			{ name: 'help impact loads the impact family', input: ['help', 'impact'], output: impact },
			{ name: 'no token leaves every row as a placeholder', input: [], output: none }
		]
	);
});
