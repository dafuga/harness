import { expect, test } from 'vitest';
import { buildProgram } from '../../../src/cli/program';
import { loadCliProgram } from '../../../src/cli/loadCliProgram';

test('cheap root help matches the synchronous compatibility command surface', async () => {
	const lazy = await loadCliProgram([]);
	expect(lazy.helpInformation()).toBe(buildProgram().helpInformation());
});

test('selected command registrations preserve every help surface and alias', async () => {
	const full = buildProgram();
	for (const expected of full.commands) {
		for (const name of [expected.name(), ...expected.aliases()]) {
			const lazy = await loadCliProgram([name, '--help']);
			const actual = lazy.commands.find((command) => command.name() === expected.name());
			expect(actual?.helpInformation(), name).toBe(expected.helpInformation());
		}
	}
	const helpLoop = await loadCliProgram(['help', 'loop']);
	expect(helpLoop.commands.find((c) => c.name() === 'loop')?.helpInformation()).toBe(
		full.commands.find((c) => c.name() === 'loop')?.helpInformation()
	);
});
