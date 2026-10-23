import type { ChildProcess } from 'node:child_process';
import type {
	processDescendants,
	ProcessTable,
	TrackedProcess
} from '../../development-tooling/processDescendants';
import type { ProcessProbes } from '../../development-tooling/processProbes';
import type { ServiceAuthority, ServiceContext } from '../platformServices';

export interface IsolatedRun {
	command: string;
	/** Transparent stdio for managed coding CLIs; captured logs remain the default. */
	stdio?: 'inherit';
	signal?: AbortSignal;
	onSpawn?: (pid: number) => void;
	args: string[];
	cwd: string;
	env: Record<string, string | undefined>;
	/**
	 * Hard limit. When it passes the command and what it started are stopped: on macOS one judged
	 * process at a time, elsewhere by a signal to the command's process group.
	 */
	timeoutMs: number;
	log: string;
	maxLogBytes: number;
	/** For tests of the protection itself: who vouches, how processes are read, the cleanup bound. */
	platform?: {
		authority?: () => ServiceAuthority | null;
		table?: ProcessTable;
		probes?: ProcessProbes;
		cleanupMs?: number;
	};
}

export interface IsolatedResult {
	status: 'passed' | 'failed' | 'timeout';
	exitCode: number | null;
	timedOut: boolean;
	durationMs: number;
	log: { path: string; bytes: number; sha256: string };
	/**
	 * Processes the command started that were still running after it ended and after the grace
	 * period. A command that leaves any has not passed. Its own are stopped; on macOS one that
	 * may be a shared service, or is not shown to be the command's own, is never signalled.
	 */
	survivors: TrackedProcess[];
	/** How many of the survivors were stopped; all of them when absent. */
	stopped?: number;
	/** How many were sent a signal and still ran at the last look; none when absent. */
	resisted?: number;
	/** What the command left could not be established; nothing more was signalled for it. */
	unknown?: boolean;
}
export /** `unknown`: what the command left could not be read, so it is not known to be nothing. */
type Outcome = Pick<IsolatedResult, 'exitCode' | 'timedOut' | 'survivors'> & {
	stopped: number;
	resisted: number;
	unknown: boolean;
};
export type Followed = ReturnType<typeof processDescendants>;
export interface Running {
	run: IsolatedRun;
	child: ChildProcess;
	descendants: Followed;
	guard: ServiceContext | null;
}
