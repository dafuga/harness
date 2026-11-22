import type { recordExampleCases } from '../support/recordExampleCases';
import type { CommanderError } from 'commander';

export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

export type Written = { stdout: string[]; stderr: string[] };

export type Dispatched = { calls: string[][]; stop?: CommanderError; written: Written };

export type Described = {
	name: string;
	description: string;
	arguments: Array<{ name: string; required: boolean; variadic: boolean }>;
	options: string[];
	commands: string[];
};
