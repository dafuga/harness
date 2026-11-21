// @harness-uid u_lad4jddhgv
import type {
	ResourceConfig,
	ResourceSnapshot
} from '../../../core/execution-runtimes/resourceTypes';
import type {
	ResourceHost,
	ResourceHostClassification,
	ResourcePlacementPolicy
} from '../../../core/execution-runtimes/resourcePlacementTypes';
import { resourcePressure } from '../resource-queue-service/resource-policy/resourcePolicy';

const MINUTE_MS = 60_000;

/**
 * Classifies a computer's latest resource snapshot for placement as offline, overloaded,
 * busy or ok. Stale or unusable telemetry is offline; Harness reserve exhaustion is overloaded.
 */
export function classifyResourceHost(
	host: ResourceHost,
	policy: ResourcePlacementPolicy,
	now: number
): ResourceHostClassification {
	const sample = host.snapshot;
	if (!sample) return offline(['never reported a sample'], null);
	const ageMs = now - sample.sampledAt;
	const unusable = unusableState(sample, policy, ageMs);
	if (unusable) return unusable;
	const pressure = resourcePressure(sample, harnessConfig(policy), now);
	return judgedState(sample, pressure, policy, ageMs);
}

/** Offline when the snapshot is unavailable or older than the stale limit; otherwise null. */
function unusableState(
	sample: ResourceSnapshot,
	policy: ResourcePlacementPolicy,
	ageMs: number
): ResourceHostClassification | null {
	if (sample.status !== 'available') {
		return offline([sample.reason ?? 'telemetry unavailable'], ageMs);
	}
	if (ageMs > policy.staleAfterMs) {
		return offline([`no sample for ${Math.round(ageMs / MINUTE_MS)} min`], ageMs);
	}
	return null;
}

/** Harness pressure, then macOS memory pressure, then busy headroom, decides a fresh sample. */
function judgedState(
	sample: ResourceSnapshot,
	pressure: string | null,
	policy: ResourcePlacementPolicy,
	ageMs: number
): ResourceHostClassification {
	if (pressure?.startsWith('Invalid') || pressure?.startsWith('Resource telemetry')) {
		return offline([pressure], ageMs);
	}
	if (pressure) return { status: 'overloaded', reasons: [pressure], ageMs };
	if (sample.memoryPressure === 'critical') {
		return { status: 'overloaded', reasons: ['macOS memory pressure critical'], ageMs };
	}
	const busy = busyReasons(sample, policy);
	return busy.length
		? { status: 'busy', reasons: busy, ageMs }
		: { status: 'ok', reasons: [], ageMs };
}

function offline(reasons: string[], ageMs: number | null): ResourceHostClassification {
	return { status: 'offline', reasons, ageMs };
}

function busyReasons(sample: ResourceSnapshot, policy: ResourcePlacementPolicy): string[] {
	const reasons: string[] = [];
	if (sample.memoryPressure === 'warning') reasons.push('macOS memory pressure warn');
	const idle = sample.cpuAvailableCores / sample.usableCores;
	if (idle < policy.busyIdleFraction) {
		const busyCores = Math.round((sample.usableCores - sample.cpuAvailableCores) * 10) / 10;
		reasons.push(`${busyCores} of ${sample.usableCores} cores busy`);
	}
	return reasons;
}

function harnessConfig(policy: ResourcePlacementPolicy): ResourceConfig {
	return {
		schemaVersion: 1,
		cpuReservePercent: policy.cpuReservePercent,
		memoryReservePercent: policy.memoryReservePercent,
		minMemoryReserveMiB: policy.minMemoryReserveMiB,
		pollMs: 1000,
		staleSampleMs: policy.staleAfterMs
	};
}
