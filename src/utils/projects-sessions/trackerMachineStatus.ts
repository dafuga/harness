// @harness-uid u_gkkvalncwm
import type {
	TrackerMachineRole,
	TrackerMachineRow,
	TrackerMachineState,
	TrackerResourceSample
} from './trackerMachine.types';

const minute = 60_000;
/** A computer is offline after five minutes without a sample. */
export const trackerSampleOfflineMs = 5 * minute;
const swapWindow = 10 * minute;

export const trackerBusyLoadPerCore = 1;
export const trackerOverloadedLoadPerCore = 1.5;
export const trackerMacLaunchLoad = 15;

const overloaded = {
	loadPerCore: trackerOverloadedLoadPerCore,
	ramPct: 10,
	swapGrowthMB: 512,
	diskFreeGB: 20
};
const busy = { loadPerCore: trackerBusyLoadPerCore, ramPct: 15, swapGrowthMB: 256, diskFreeGB: 30 };

const roles = new Map<string, TrackerMachineRole>([
	['grok-box', 'shared'],
	['harbor-mbp-2', 'runner'],
	['daniel-primary-mbp', 'primary']
]);

export function trackerMachineRole(node: string): TrackerMachineRole {
	return roles.get(node) ?? 'other';
}

/** Judge a computer from its latest sample and the samples of the last few minutes. */
export function trackerMachineStatus(
	latest: TrackerResourceSample | null,
	recent: readonly TrackerResourceSample[],
	now: number
): Pick<TrackerMachineRow, 'status' | 'reasons' | 'age_s'> {
	if (!latest) return { status: 'offline', reasons: ['never reported a sample'], age_s: null };
	const age = now - Date.parse(latest.at);
	const age_s = Math.round(age / 1000);
	if (!(age <= trackerSampleOfflineMs))
		return { status: 'offline', reasons: [`no sample for ${Math.round(age / minute)} min`], age_s };
	const growth = swapGrowthMB([...recent, latest], now);
	for (const [status, limits] of levels) {
		const reasons = breaches(latest, growth, { limits, status });
		if (reasons.length) return { status, reasons, age_s };
	}
	return { status: 'ok', reasons: [], age_s };
}

const levels = [
	['overloaded', overloaded],
	['busy', busy]
] as const;

/** Swap growth in MB from the oldest to the newest sample of the last ten minutes. */
function swapGrowthMB(samples: readonly TrackerResourceSample[], now: number): number {
	const window = samples
		.filter(({ at }) => now - Date.parse(at) <= swapWindow)
		.sort((left, right) => left.at.localeCompare(right.at));
	const first = window.at(0);
	const last = window.at(-1);
	return first && last ? last.swap.used_mb - first.swap.used_mb : 0;
}

function breaches(
	sample: TrackerResourceSample,
	growth: number,
	{ limits, status }: { limits: typeof overloaded; status: TrackerMachineState }
): string[] {
	const reasons: string[] = [];
	const load = sample.load[1] ?? 0;
	const loadLimit = limits.loadPerCore * sample.cores;
	if (load > loadLimit)
		reasons.push(
			`5-min load ${load} > ${round(loadLimit)} (${limits.loadPerCore}x ${sample.cores} cores)`
		);
	reasons.push(...memoryBreaches(sample.ram, limits.ramPct, status));
	if (growth > limits.swapGrowthMB) reasons.push(`swap grew ${growth} MB in 10 min`);
	// Absolute free space protects a disk; a percentage floor would hold a large, full-ish disk.
	for (const disk of sample.disks)
		if (disk.free_gb < limits.diskFreeGB)
			reasons.push(`disk ${disk.mount} ${disk.free_gb} GB free (${disk.free_pct}%)`);
	return reasons;
}

function memoryBreaches(
	ram: TrackerResourceSample['ram'],
	floor: number,
	status: TrackerMachineState
): string[] {
	const reasons: string[] = [];
	// macOS counts reclaimable memory in its own reading, so prefer it when present.
	const percent = ram.pressure_free_pct ?? ram.available_pct;
	if (percent < floor)
		reasons.push(
			`RAM available ${percent}% < ${floor}% (${round(ram.available_mb / 1024)} GB free)`
		);
	const pressure = status === 'overloaded' ? 'critical' : 'warn';
	if (ram.pressure === pressure) reasons.push(`macOS memory pressure ${pressure}`);
	return reasons;
}

function round(value: number): number {
	return Math.round(value * 10) / 10;
}
