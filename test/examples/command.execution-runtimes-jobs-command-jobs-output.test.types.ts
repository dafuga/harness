import type {
	printJobEta,
	printJobStats
} from '../../src/commands/execution-runtimes/jobs-command/jobsOutput';

export type Queue = Parameters<typeof printJobEta>[0];

export type Groups = Parameters<typeof printJobStats>[0];

export type Case = { name: string; input: unknown; output: unknown };
