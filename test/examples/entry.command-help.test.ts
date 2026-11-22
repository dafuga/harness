import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { commandHelp } from '../../src/cli/commandHelp';

test('Lists commands with aliases and display terms', () => {
	const generate = commandHelp.find((command) => command.name === 'generate');
	const info = commandHelp.find((command) => command.name === 'info');
	expect(commandHelp.length).toBeGreaterThan(0);
	expect(generate).toEqual({
		name: 'generate',
		signature: 'generate',
		description: 'Generate Harness code.',
		term: 'generate|g',
		aliases: ['g']
	});
	expect(info?.term).toBe('info [options] <topic>');
	const cases = [{
		name: 'generate alias and info display term',
		input: ['generate', 'info'],
		output: {
			generate: { signature: generate?.signature, term: generate?.term, aliases: generate?.aliases },
			info: { signature: info?.signature, term: info?.term, aliases: info?.aliases }
		}
	}];
	recordExampleCases(
		{
			unitId: 'entry.command-help',
			symbol: 'commandHelp',
			state: 'lists-commands-with-aliases-and-display-terms',
			evidence: 'examples-cases',
			file: 'lists-commands-with-aliases-and-display-terms.json'
		},
		cases
	);
});
