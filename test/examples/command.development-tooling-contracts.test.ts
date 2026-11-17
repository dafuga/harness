import { Command } from 'commander';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { ContractsCommand } from '../../src/commands/development-tooling/ContractsCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

function register(program: Command): void {
	new ContractsCommand().register(program);
}

async function parserError(argv: string[]): Promise<unknown> {
	const program = new Command().name('harness').exitOverride();
	register(program);
	try {
		await program.parseAsync(argv, { from: 'user' });
	} catch (error) {
		return error;
	}
	throw new Error(`Commander accepted ${argv.join(' ')}`);
}

async function listCatalog(program: Command, root: string): Promise<string[]> {
	await mkdir(join(root, 'specification', 'units'), { recursive: true });
	const output: string[] = [];
	const logged = vi.spyOn(console, 'log').mockImplementation((value) => {
		output.push(String(value));
	});
	try {
		await program.parseAsync(['contracts', 'list', '--json', '--root', root], { from: 'user' });
		return output;
	} finally {
		logged.mockRestore();
	}
}

function summarizeError(error: unknown): { name: string; message: string } {
	return {
		name: error instanceof Error ? error.name : 'UnknownError',
		message: error instanceof Error ? error.message : String(error)
	};
}

function recordCases(results: {
	returned: void;
	subcommands: string[];
	output: string[];
	limitError: unknown;
	depthError: unknown;
}): void {
	recordExampleCases(
		{
			unitId: 'command.development-tooling-contracts',
			symbol: 'ContractsCommand.register',
			state: 'registers-contracts-commands-and-runs-a-read-only-list',
			evidence: 'examples-cases',
			file: 'registers-contracts-commands-and-runs-a-read-only-list.json'
		},
		[
			{
				name: 'harness lists an empty temporary contract catalog',
				input: {
					program: 'harness',
					argv: ['contracts', 'list', '--json', '--root', '<temporary-root>']
				},
				output: {
					returned: results.returned ?? null,
					subcommands: results.subcommands,
					stdout: results.output
				}
			},
			{
				name: 'harness refuses a zero limit',
				input: { program: 'harness', argv: ['contracts', 'list', '--limit', '0'] },
				error: summarizeError(results.limitError)
			},
			{
				name: 'harness refuses depth eleven',
				input: { program: 'harness', argv: ['contracts', 'map', 'src', '--depth', '11'] },
				error: summarizeError(results.depthError)
			}
		]
	);
}

test('Registers contracts commands and runs a read-only list', async () => {
	const program = new Command().name('harness').exitOverride();
	const returned = new ContractsCommand().register(program);
	const contracts = program.commands.find((command) => command.name() === 'contracts');
	const subcommands = contracts?.commands.map((command) => command.name()) ?? [];
	expect(returned).toBeUndefined();
	expect(subcommands).toEqual(['diff', 'log', 'last', 'show', 'list', 'search', 'map']);

	await withTempDir('harness-contracts-command-', async (root) => {
		const output = await listCatalog(program, root);
		expect(output).toEqual(['[]']);
		const limitError = await parserError(['contracts', 'list', '--limit', '0']);
		const depthError = await parserError(['contracts', 'map', 'src', '--depth', '11']);
		expect(summarizeError(limitError).message).toMatch(/positive integer/i);
		expect(summarizeError(depthError).message).toMatch(/integer from 0 to 10/i);
		recordCases({ returned, subcommands, output, limitError, depthError });
	});
});

test('Throws InvalidArgumentError for invalid limit and depth tokens', async () => {
	const limitError = await parserError(['contracts', 'list', '--limit', '01']);
	const depthError = await parserError(['contracts', 'map', 'src', '--depth', '11']);
	expect(summarizeError(limitError)).toMatchObject({
		name: 'CommanderError',
		message: expect.stringMatching(/positive integer/i)
	});
	expect(summarizeError(depthError)).toMatchObject({
		name: 'CommanderError',
		message: expect.stringMatching(/integer from 0 to 10/i)
	});
	recordExampleCases(
		{
			unitId: 'command.development-tooling-contracts',
			symbol: 'ContractsCommand.register',
			state: 'throws-invalidargumenterror-for-invalid-limit-and-depth-toke',
			evidence: 'examples-cases',
			file: 'throws-invalidargumenterror-for-invalid-limit-and-depth-toke.json'
		},
		[
			{
				name: 'a leading-zero limit is rejected',
				input: { argv: ['contracts', 'list', '--limit', '01'] },
				error: summarizeError(limitError)
			},
			{
				name: 'a depth above ten is rejected',
				input: { argv: ['contracts', 'map', 'src', '--depth', '11'] },
				error: summarizeError(depthError)
			}
		]
	);
});

test('Throws ExpectedCliError when a read-only query has no matching target', async () => {
	await withTempDir('harness-contracts-missing-target-', async (root) => {
		await mkdir(join(root, 'specification', 'units'), { recursive: true });
		const program = new Command().name('harness').exitOverride();
		register(program);
		let caught: unknown;
		try {
			await program.parseAsync(
				['contracts', 'show', 'missing.unit', '--root', root],
				{ from: 'user' }
			);
		} catch (error) {
			caught = error;
		}
		expect(summarizeError(caught)).toMatchObject({
			name: 'ExpectedCliError',
			message: expect.stringContaining('No contracts match')
		});
		recordExampleCases(
			{
				unitId: 'command.development-tooling-contracts',
				symbol: 'ContractsCommand.register',
			state: 'throws-expectedclierror-when-a-read-only-query-has-no-matchi',
				evidence: 'examples-cases',
			file: 'throws-expectedclierror-when-a-read-only-query-has-no-matchi.json'
			},
			[
				{
					name: 'show reports a missing unit from an empty stored catalog',
					input: {
						argv: ['contracts', 'show', 'missing.unit', '--root', '<temporary-root>']
					},
					error: summarizeError(caught)
				}
			]
		);
	});
});
