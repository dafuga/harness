import type { FollowedProcess } from '../development-tooling/processDescendants';
import type { TrackedProcess } from '../development-tooling/processDescendants';
import type { Verdict } from './platformServices';

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
