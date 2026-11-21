// @harness-uid u_pl4cmnt2aa
import type { ResourcePlacementPolicy } from './resourcePlacementTypes.types';

export type {
	ResourceCandidate,
	ResourceChoice,
	ResourceCli,
	ResourceHost,
	ResourceHostClassification,
	ResourceHostRole,
	ResourceHostStatus,
	ResourcePlacement,
	ResourcePlacementPolicy,
	ResourceReservation,
	ResourceRunnerState,
	ResourceWork,
	ResourceWorkKind
} from './resourcePlacementTypes.types';

/** Tracker-equivalent defaults: five minutes to offline, 4 GiB kept free on the shared box. */
export const defaultResourcePlacementPolicy: ResourcePlacementPolicy = {
	staleAfterMs: 5 * 60_000,
	keepFreeMiB: { shared: 4096, default: 2048 },
	busyIdleFraction: 0.25,
	cpuReservePercent: 10,
	memoryReservePercent: 10,
	minMemoryReserveMiB: 2048
};
