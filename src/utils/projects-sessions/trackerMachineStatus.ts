// @harness-uid u_gkkvalncwm
import type {
	TrackerMachineRole,
	TrackerMachineRow,
	TrackerResourceSample
} from './trackerMachine.types';

const minute = 60_000;
/** A computer is offline after five minutes without a sample. */
export const trackerSampleOfflineMs = 5 * minute;
const swapWindow = 10 * minute;
const severeLoadPerCore = 3;
const sustainedLoadWindow = 10 * minute;
const sampleGap = 150_000;

export function trackerDiskAlertFloor(platform: string): number {
	return platform === 'darwin' ? 60 : 20;
}

export const trackerBusyLoadPerCore = 1;

const overloadLoadPerCore = 1.5;

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
	const reasons = overloadReasons(latest, recent);
	if (reasons.length) return { status: 'overloaded', reasons, age_s };
	const busy = busyReasons(latest, recent);
	return { status: busy.length ? 'busy' : 'ok', reasons: busy, age_s };
}

function overloadReasons(latest: TrackerResourceSample, recent: readonly TrackerResourceSample[]) {
	const reasons: string[] = [];
	const load = confirmedLoad(latest, recent);
	if (load) reasons.push(`System load ${round(load / latest.cores)}× capacity`);
	const memory = latest.ram.pressure_free_pct ?? latest.ram.available_pct;
	if (latest.ram.pressure === 'warn' || latest.ram.pressure === 'critical')
		reasons.push(`Memory nearly full (macOS pressure: ${latest.ram.pressure})`);
	else if (memory < 10) reasons.push(`Memory nearly full (${memory}% available)`);
	for (const { mount, free_gb } of latest.disks)
		if (free_gb < trackerDiskAlertFloor(latest.platform))
			reasons.push(`Disk nearly full (${free_gb} GB free on ${mount})`);
	return reasons;
}

function confirmedLoad(latest: TrackerResourceSample, recent: readonly TrackerResourceSample[]) {
	const at = Date.parse(latest.at);
	const readings = recent
		.filter((sample) => Date.parse(sample.at) < at)
		.sort((left, right) => right.at.localeCompare(left.at));
	const prior = readings[0];
	const oneMinute = latest.load[0] ?? 0;
	const fiveMinutes = latest.load[1] ?? 0;
	if (
		oneMinute > severeLoadPerCore * latest.cores &&
		prior &&
		at - Date.parse(prior.at) <= sampleGap &&
		(prior.load[0] ?? 0) > severeLoadPerCore * prior.cores
	)
		return oneMinute;
	if (isAboveLoadGuard(latest) && hasSustainedLoad(at, readings)) return fiveMinutes;
	return 0;
}

function hasSustainedLoad(at: number, readings: TrackerResourceSample[]): boolean {
	let previous = at;
	for (const sample of readings) {
		const time = Date.parse(sample.at);
		if (previous - time > sampleGap || !isAboveLoadGuard(sample)) break;
		if (at - time >= sustainedLoadWindow) return true;
		previous = time;
	}
	return false;
}

function isAboveLoadGuard(sample: TrackerResourceSample): boolean {
	const limit = overloadLoadPerCore * sample.cores;
	return (sample.load[0] ?? 0) > limit && (sample.load[1] ?? 0) > limit;
}

function busyReasons(latest: TrackerResourceSample, recent: readonly TrackerResourceSample[]) {
	const reasons: string[] = [];
	const load = Math.max(latest.load[1] ?? 0, latest.load[0] ?? 0);
	if (load > trackerBusyLoadPerCore * latest.cores)
		reasons.push(`System load ${round(load / latest.cores)}× capacity`);
	const memory = latest.ram.pressure_free_pct ?? latest.ram.available_pct;
	if (memory < 15) reasons.push(`Memory low (${memory}% available)`);
	const growth = swapGrowthMB(latest, recent);
	if (growth > 256) reasons.push(`Swap grew ${growth} MB in 10 min`);
	for (const { mount, free_gb } of latest.disks)
		if (free_gb < 30) reasons.push(`Disk space low (${free_gb} GB free on ${mount})`);
	return reasons;
}

function swapGrowthMB(latest: TrackerResourceSample, recent: readonly TrackerResourceSample[]) {
	const at = Date.parse(latest.at);
	const first = recent
		.filter((sample) => Date.parse(sample.at) >= at - swapWindow && sample.at < latest.at)
		.sort((left, right) => left.at.localeCompare(right.at))[0];
	return first ? latest.swap.used_mb - first.swap.used_mb : 0;
}

function round(value: number): number {
	return Math.round(value * 10) / 10;
}
