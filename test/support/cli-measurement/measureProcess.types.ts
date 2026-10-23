import type { CommandResult } from '../cli';
export type Runner = (
	args: string[],
	cwd: string,
	success?: boolean,
	env?: Record<string, string>
) => Promise<CommandResult>;
export interface ProcessInput {
	units: string[];
	workload: string;
	target: 'process' | 'module';
	command: string[];
	cwd: string;
	expectSuccess?: boolean;
	env?: Record<string, string>;
	partial?: string;
}
