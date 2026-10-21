import type { Verdict } from './platformServices';
import type { FollowedProcess, TrackedProcess } from '../development-tooling/processDescendants';

/** What reads the command, what it started and its group; null when that cannot be read. */
export interface Watched {
	alive(): Promise<FollowedProcess[] | null>;
}

export interface Settlement {
	/** What counts against the command: its own leftovers, and what could not be told apart. */
	survivors: TrackedProcess[];
	/** How many of them were stopped. */
	stopped: number;
	/** How many were sent a signal and still ran at the last look. The rest was never signalled. */
	resisted: number;
	/** What was left could not be read or judged in time: nothing more was signalled. */
	unknown: boolean;
	/** One line for every process that was handed over, left alone or stopped. */
	report: string;
}

export interface Judged extends FollowedProcess {
	verdict: Verdict;
}

/** The answer when what was left could not be established: nothing passes on it. */
export function unknownSettlement(why: string): Settlement {
	const told = 'nothing more was signalled, what the command left is unknown, and the check fails';
	const report = `\n[harness] ${why}: ${told}\n`;
	return { survivors: [], stopped: 0, resisted: 0, unknown: true, report };
}

export { settlementReport } from './run-isolated/settlementReport';
