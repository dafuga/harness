// @harness-uid u_pl4cmnt2aa
import type { ResourceRequest, ResourceSnapshot } from './resourceTypes';

/**
 * Placement vocabulary for choosing a computer for work. Resource numbers use the Harness
 * ResourceSnapshot and ResourceRequest shapes. Decision results keep the Tracker placement
 * vocabulary (recommended, ranked, fits, score, reasons, node, why).
 */

export type ResourceHostRole = 'primary' | 'runner' | 'shared' | 'other';
export type ResourceHostStatus = 'ok' | 'busy' | 'overloaded' | 'offline';
export type ResourceWorkKind = 'codex' | 'claude' | 'browser-tests' | 'build' | 'general';
export type ResourceCli = 'codex' | 'claude';

/** What a computer's launcher advertises next to its resource snapshot. */
export interface ResourceRunnerState {
	enabled: boolean;
	maxConcurrent: number;
	/** Sessions running now on this computer (queued work excluded). */
	activeSessions: number;
	/** Sessions running now that are outside the home projects. */
	otherActiveSessions: number;
	diskHold: string | null;
	quotaHolds: Partial<Record<ResourceCli, string | null>>;
	codexPaused: boolean;
	projects: string[];
	repoPaths: string[];
	/** Projects with a dedicated share of the computer (Harbor on MB2). Empty means no cap. */
	homeProjects: string[];
	/** Maximum non-home sessions at once; null means no cap. */
	otherMax: number | null;
	/** CPU budget for non-home work, in cores; null means no budget. */
	otherCores: number | null;
	/** Non-home sessions' CPU use, in percent (100 is one core). */
	otherCpuPercent: number;
	/** Busy cores at or above which new non-home work waits; null means no limit. */
	otherLoadLimitCores: number | null;
}

/** One computer: its latest Harness resource snapshot, workload and launcher state. */
export interface ResourceHost {
	node: string;
	role: ResourceHostRole;
	snapshot: ResourceSnapshot | null;
	/** Agent sessions and heavy test or browser groups, counted for ranking. */
	workload: { agentSessions: number; heavyGroups: number };
	runner: ResourceRunnerState | null;
}

/** Work that is waiting for a computer. */
export interface ResourceWork {
	kind: ResourceWorkKind;
	request: Pick<ResourceRequest, 'cpus' | 'memoryMiB'>;
	project: string | null;
	cli: ResourceCli | null;
	/** Explicit repository path, when the work names one. */
	repo: string | null;
	heavy: boolean;
	light: boolean;
	/** Due launches honour an explicit computer and the shared box's light-work rule. */
	due: boolean;
	/** Explicit computer chosen for the work; null means automatic placement. */
	requestedNode: string | null;
}

/** A session already reserved on a computer by this placement round. */
export interface ResourceReservation {
	node: string;
	project: string | null;
}

/** Tunable placement rules. Defaults mirror the Tracker's placement decisions. */
export interface ResourcePlacementPolicy {
	/** Telemetry older than this makes a computer offline (Tracker: 5 minutes). */
	staleAfterMs: number;
	/** RAM kept free after the work starts, by role, in MiB. */
	keepFreeMiB: { shared: number; default: number };
	/** A computer with less than this fraction of usable cores idle is busy. */
	busyIdleFraction: number;
	/** Harness reserve rules used to detect overload (CPU and memory reserve exhausted). */
	cpuReservePercent: number;
	memoryReservePercent: number;
	minMemoryReserveMiB: number;
}

export interface ResourceHostClassification {
	status: ResourceHostStatus;
	reasons: string[];
	ageMs: number | null;
}

export interface ResourceCandidate {
	node: string;
	fits: boolean;
	score: number;
	role: ResourceHostRole;
	status: ResourceHostStatus;
	reasons: string[];
}

export interface ResourcePlacement {
	kind: ResourceWorkKind;
	needsMemoryMiB: number;
	recommended: string | null;
	ranked: ResourceCandidate[];
}

export interface ResourceChoice {
	node: string | null;
	why: string;
}
