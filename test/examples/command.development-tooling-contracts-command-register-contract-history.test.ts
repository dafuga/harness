import { Command } from 'commander';
import { test } from 'vitest';
import { registerContractHistory } from '../../src/commands/development-tooling/contracts-command/registerContractHistory';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const UNIT_ID = 'command.development-tooling-contracts-command-register-contract-history';
const HISTORY_OPTIONS = [
	'--kind <kind>',
	'--area <name>',
	'--folder <path>',
	'--field <fields>',
	'--summary',
	'--limit <count>',
	'--json'
];
const LOG_OPTIONS = [...HISTORY_OPTIONS, '--since <revision>'];

function describeCommand(command: Command) {
	return {
		name: command.name(),
		arguments: command.registeredArguments.map((argument) => ({
			name: argument.name(),
			required: argument.required
		})),
		options: command.options.map((option) => option.flags)
	};
}

function findSubcommand(contracts: Command, name: string): Command | undefined {
	return contracts.commands.find((command) => command.name() === name);
}

function parseLimit(contracts: Command, text: string): unknown {
	const limit = findSubcommand(contracts, 'log')?.options.find(
		(option) => option.long === '--limit'
	);
	return limit?.parseArg?.(text, undefined);
}

function limitCase(contracts: Command, text: string) {
	try {
		return { name: `--limit ${text}`, input: text, output: parseLimit(contracts, text) };
	} catch (error) {
		return { name: `--limit ${text}`, input: text, error: (error as Error).message };
	}
}

test('Registers diff, log and last under contracts', () => {
	const contracts = new Command('contracts');
	const returned = registerContractHistory(contracts);
	const commands = contracts.commands.map(describeCommand);

	expect(returned).toBeUndefined();
	expect(contracts.commands.map((command) => command.name())).toEqual(['diff', 'log', 'last']);
	expect(commands).toEqual([
		{
			name: 'diff',
			arguments: [
				{ name: 'revision', required: false },
				{ name: 'head', required: false }
			],
			options: [
				...HISTORY_OPTIONS,
				'--unit <id>',
				'--since <revision>',
				'--staged'
			]
		},
		{
			name: 'log',
			arguments: [{ name: 'unit', required: false }],
			options: LOG_OPTIONS
		},
		{
			name: 'last',
			arguments: [{ name: 'unit', required: true }],
			options: LOG_OPTIONS
		}
	]);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'registerContractHistory',
			state: 'registers-diff-log-and-last-under-contracts',
			evidence: 'examples-cases',
			file: 'registers-diff-log-and-last-under-contracts.json'
		},
		[
			{
				name: 'an empty contracts group',
				input: { contracts: 'contracts', existingCommands: [] },
				output: { returned: returned ?? null, commands }
			}
		]
	);
});

test('Limit parser accepts positive integers only', () => {
	const contracts = new Command('contracts');
	registerContractHistory(contracts);
	const cases = ['5', '1', '0', '007', '9007199254740993', '12a'].map((text) =>
		limitCase(contracts, text)
	);

	expect(parseLimit(contracts, '5')).toBe(5);
	expect(parseLimit(contracts, '1')).toBe(1);
	expect(() => parseLimit(contracts, '0')).toThrow('Expected a positive integer.');
	expect(() => parseLimit(contracts, '007')).toThrow('Expected a positive integer.');
	expect(() => parseLimit(contracts, '9007199254740993')).toThrow(
		'Expected a positive integer.'
	);
	expect(() => parseLimit(contracts, '12a')).toThrow('Expected a positive integer.');
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'registerContractHistory',
			state: 'limit-parser-accepts-positive-integers-only',
			evidence: 'examples-cases',
			file: 'limit-parser-accepts-positive-integers-only.json'
		},
		cases
	);
});
