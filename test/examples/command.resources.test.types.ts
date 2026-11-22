import type { recordExampleCases } from '../support/recordExampleCases';
import type { CommanderError } from 'commander';

/**
 * registerResourcesCommand is called on a program the way buildProgram calls it. The status,
 * configure and run actions read the resource home from the environment and sample this machine,
 * so they are not dispatched here. The examples show what was attached, and that commander refuses
 * help and bad input before any action runs. Registration stores nothing: no temporary directory.
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
