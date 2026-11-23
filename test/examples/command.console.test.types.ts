import type { recordExampleCases } from '../support/recordExampleCases';
import type { CommanderError, Command } from 'commander';

/**
 * registerConsoleCommand is called the way buildProgram calls it. The examples show what it
 * attached and where commander stops before a subcommand action: help and refused input never
 * reach one. The actions read or write a SvelteKit host, so none runs here; registration stores
 * nothing.
 */
export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

export type Written = { stdout: string[]; stderr: string[] };

export type Stopped = { written: Written; stop: CommanderError };

export type Registered = { root: Command; consoleCommand: Command; written: Written };

export type Described = {
	name: string;
	description: string;
	arguments: Array<{ name: string; required: boolean }>;
	options: Array<{ flags: string; mandatory: boolean; default?: unknown }>;
	commands: Described[];
};
