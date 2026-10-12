import type { ChildProcess } from 'node:child_process';
import { setTimeout } from 'node:timers';
import { signalProcesses, type Descendants, type TrackedProcess } from './processDescendants';

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

/**
 * What a command left behind, where its group is signalled. That group is killed; a process
 * that put itself in another group or session is followed by its parent links instead. Such a
 * process gets a moment to end by itself, as a browser or server being shut down does, and is
 * then stopped. What is returned was stopped and counts against the command.
 */
export async function groupTeardown(
	child: ChildProcess,
	descendants: Descendants,
	timing: GroupTiming
): Promise<TrackedProcess[]> {
	signalGroup(child, 'SIGKILL');
	let left = await descendants.survivors();
	for (let waited = 0; left.length > 0 && waited < timing.settleMs; waited += 100) {
		await new Promise((resolve) => setTimeout(resolve, 100));
		left = await descendants.survivors();
	}
	if (left.length === 0) return [];
	await signalProcesses(left, 'SIGTERM');
	await new Promise((resolve) => setTimeout(resolve, timing.graceMs));
	await signalProcesses(left, 'SIGKILL');
	return left;
}
