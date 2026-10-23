import type { ChildProcess } from 'node:child_process';

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

export type { GroupTiming } from './groupTeardown.types';
