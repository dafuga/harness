import type { CommandResult } from '../cli';

export type Runner = (
	args: string[],
	cwd: string,
	success?: boolean,
	env?: Record<string, string>
) => Promise<CommandResult>;

export interface Input {
	args: string[];
	cwd: string;
	expectSuccess: boolean;
	env: Record<string, string>;
	command: string[];
	source: string;
}
