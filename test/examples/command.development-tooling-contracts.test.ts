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
