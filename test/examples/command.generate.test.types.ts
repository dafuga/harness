import type { recordExampleCases } from '../support/recordExampleCases';

/**
 * registerGenerateCommand is called on a program the way buildProgram calls it. Commander runs an
 * action only when it dispatches to that subcommand, so these examples dispatch only to inputs that
 * stop before any generator writes: help, commander's own refusals, and the --level check. Other
 * actions write into the working directory, so they are not dispatched here. Registration stores
 * nothing, so no temporary directory is needed.
 */
export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

export type Written = { stdout: string[]; stderr: string[] };

export type Stop = { argv: string[]; written: Written; error: Error };

export type Described = {
	name: string;
	description: string;
	arguments: Array<{ name: string; required: boolean }>;
	options: Array<{ flags: string; default?: unknown }>;
	commands: string[];
};
