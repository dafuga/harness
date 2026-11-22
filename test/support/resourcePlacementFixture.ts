import { mib, type ResourceSnapshot } from '../../src/core/execution-runtimes/resourceTypes';
import {
	defaultResourcePlacementPolicy,
	type ResourceHost,
	type ResourceHostRole,
	type ResourceRunnerState,
	type ResourceWork
} from '../../src/core/execution-runtimes/resourcePlacementTypes';

/** A fixed clock so that artificial sample ages are exact. */
export const NOW = 1_800_000_000_000;
export const policy = defaultResourcePlacementPolicy;

/** Artificial Harness resource snapshot: 10 usable cores, 16 GiB RAM, 12 GiB free, fresh. */
export function snapshot(changes: Partial<ResourceSnapshot> = {}): ResourceSnapshot {
	return {
		status: 'available',
		sampledAt: NOW,
		logicalCores: 10,
		usableCores: 10,
		cpuUsedPercent: 0,
		cpuAvailableCores: 10,
		memoryTotalBytes: 16 * 1024 * mib,
		memoryAvailableBytes: 12 * 1024 * mib,
		memoryPressure: 'normal',
		...changes
	};
}

export function runner(changes: Partial<ResourceRunnerState> = {}): ResourceRunnerState {
	return {
		enabled: true,
		maxConcurrent: 2,
		activeSessions: 0,
		otherActiveSessions: 0,
		diskHold: null,
		quotaHolds: {},
		codexPaused: false,
		projects: ['harness', 'harbor', 'tracker'],
		repoPaths: [],
		homeProjects: [],
		otherMax: null,
		otherCores: null,
		otherCpuPercent: 0,
		otherLoadLimitCores: null,
		...changes
	};
}

export function host(
	node: string,
	role: ResourceHostRole,
	changes: {
		snapshot?: ResourceSnapshot | null;
		runner?: ResourceRunnerState | null;
		agentSessions?: number;
		heavyGroups?: number;
	} = {}
): ResourceHost {
	return {
		node,
		role,
		snapshot: changes.snapshot === undefined ? snapshot() : changes.snapshot,
		workload: { agentSessions: changes.agentSessions ?? 0, heavyGroups: changes.heavyGroups ?? 0 },
		runner: changes.runner === undefined ? runner() : changes.runner
	};
}

export function work(changes: Partial<ResourceWork> = {}): ResourceWork {
	return {
		kind: 'claude',
		request: { cpus: 1, memoryMiB: 2048 },
		project: 'harness',
		cli: 'claude',
		repo: null,
		heavy: false,
		light: false,
		due: false,
		requestedNode: null,
		...changes
	};
}
