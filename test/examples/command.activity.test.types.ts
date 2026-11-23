import type { recordExampleCases } from '../support/recordExampleCases';
import type { CommanderError } from 'commander';

/**
 * registerActivityCommand is called on a program the way buildProgram calls it. Its subcommands
 * run their actions only when commander dispatches to them, so the examples show what was attached
 * and where commander stops before an action: help and refused input never reach one. No temporary
 * directory is needed: registration stores nothing, and the actions resolve their checkout from the
 * working directory, so they are not dispatched here.
 */
export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

export type Written = { stdout: string[]; stderr: string[] };

export type Stopped = { written: Written; stop: CommanderError };

export type Described = {
	name: string;
	description: string;
	arguments: Array<{ name: string; required: boolean }>;
	options: Array<{ flags: string; default?: unknown }>;
	commands: Described[];
};
