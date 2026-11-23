import type { registerLoopLifecycleCommands } from '../../src/cli/program/loopLifecycle';

export type Action = (...args: unknown[]) => unknown;

export interface Subcommand {
	name: string;
	options: string[];
	description?: string;
	action?: Action;
}

export interface Chain {
	option(flags: string): Chain;
	description(text: string): Chain;
	action(fn: Action): Chain;
}

export type Program = Parameters<typeof registerLoopLifecycleCommands>[0];

export type Case = { name: string; input: unknown; error: unknown };
