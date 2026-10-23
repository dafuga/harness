import type { CommandResult } from './cli';

export interface PackedInstall {
	/** The temporary directory that holds the packed package, its report store and fixtures. */
	root: string;
	run(args: string[]): Promise<CommandResult>;
	/** Restores the environment and removes the directory; safe to call more than once. */
	dispose(): Promise<void>;
}

export interface ServedReports {
	url: string;
	port: number;
	/** The server process this start created. */
	pid: number;
}
