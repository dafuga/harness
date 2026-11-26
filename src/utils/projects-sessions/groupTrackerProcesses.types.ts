// @harness-uid u_bpxxjlm3vz
import type { TrackerAgentKind } from './trackerMachine.types';

export interface TrackerProcessRow {
	pid: number;
	ppid: number;
	/** Resident memory in KB. */
	rss: number;
	cpu: number;
	name: string;
}

export type Tree = {
	byPid: Map<number, TrackerProcessRow>;
	children: Map<number, TrackerProcessRow[]>;
	kinds: Map<number, TrackerAgentKind>;
};
