import type { ChildProcess } from "node:child_process";

export interface GroupTiming {
	/** How long what a command started may take to end by itself once the command has ended. */
	settleMs: number;
	graceMs: number;
}

/**
 * Signals the whole process group of a command. Not used on macOS, where a group may hold a
 * service that the system shares with other commands.
 */
export function signalGroup(child: ChildProcess, signal: 'SIGTERM' | 'SIGKILL'): void {
	try {
		if (child.pid) process.kill(-child.pid, signal);
	} catch {
		// The group is already gone.
	}
}

export { groupTeardown } from './run-isolated/groupTeardown';
