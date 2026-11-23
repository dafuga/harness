import { Command } from 'commander';
import { registerUnitsCommand } from '../../src/cli/program/UnitsCommand';

/** A program named as buildProgram names it; commander's own output is silenced and exits are thrown. */
function harnessProgram(): Command {
	return new Command()
		.name('harness')
		.exitOverride()
		.configureOutput({ writeOut: () => undefined, writeErr: () => undefined });
}

/** Parses argv against a program that holds the units command, as the CLI does. */
export async function parse(argv: string[]): Promise<void> {
	const program = harnessProgram();
	registerUnitsCommand(program);
	await program.parseAsync(argv, { from: 'user' });
}

/** The error that stopped argv, or undefined when the dispatch completed. */
export async function failure(argv: string[]): Promise<unknown> {
	try {
		await parse(argv);
	} catch (error) {
		return error;
	}
	return undefined;
}
