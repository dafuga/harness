import { expect, test } from 'vitest';
import {
	placeTrackerWork,
	trackerObservedDemand
} from '../../../src/utils/projects-sessions/placeTrackerWork';
import {
	trackerMachineRole,
	trackerMachineStatus
} from '../../../src/utils/projects-sessions/trackerMachineStatus';
import type { TrackerResourceSample } from '../../../src/utils/projects-sessions/trackerMachine.types';
import { resourceSample } from '../../support/trackerMachineFixture';

const now = Date.parse('2026-11-26T12:00:00Z');
const minute = 60_000;

function status(over: Partial<TrackerResourceSample>, recent: TrackerResourceSample[] = []) {
	return trackerMachineStatus(resourceSample(now, over), recent, now);
}

function row(node: string, over: Partial<TrackerResourceSample> = {}) {
	const sample = resourceSample(now, over);
	return {
		node,
		role: trackerMachineRole(node),
		...trackerMachineStatus(sample, [], now),
		sample
	};
}

test('judges a computer as ok, busy, overloaded or offline', () => {
	expect(status({}).status).toBe('ok');
	expect(status({ load: [1, 11, 1] }).status).toBe('busy');
	expect(status({ load: [1, 16, 1] })).toMatchObject({
		status: 'overloaded',
		reasons: ['5-min load 16 > 15 (1.5x 10 cores)']
	});
	const ram = resourceSample(now).ram;
	expect(status({ ram: { ...ram, available_pct: 5 } }).status).toBe('overloaded');
	expect(status({ ram: { ...ram, available_pct: 5, pressure_free_pct: 60 } }).status).toBe('ok');
	expect(status({ ram: { ...ram, pressure: 'critical' } }).status).toBe('overloaded');
	const earlier = resourceSample(now - 9 * minute);
	expect(status({ swap: { total_mb: 2048, used_mb: 700 } }, [earlier]).status).toBe('overloaded');
	expect(trackerMachineStatus(resourceSample(now - 6 * minute), [], now).status).toBe('offline');
	expect(trackerMachineStatus(null, [], now).reasons).toEqual(['never reported a sample']);
});

test('absolute free space protects a disk; a low percentage alone does not', () => {
	const disk = { mount: '/', total_gb: 1000, free_gb: 60, free_pct: 6 };
	expect(status({ disks: [disk] }).status).toBe('ok');
	expect(status({ disks: [{ ...disk, free_gb: 25 }] }).status).toBe('busy');
	expect(status({ disks: [{ ...disk, free_gb: 19 }] }).status).toBe('overloaded');
});

test('fits demand to live CPU and RAM across different host shapes', () => {
	const primary = row('daniel-primary-mbp', {
		cores: 18,
		ram: { total_mb: 36_864, used_mb: 8192, available_mb: 28_672, available_pct: 78 }
	});
	const mb2 = row('harbor-mbp-2', { cores: 10 });
	const rows = [primary, mb2];
	expect(placeTrackerWork(rows, { kind: 'codex' }).recommended).toBe(mb2.node);
	expect(placeTrackerWork(rows, { kind: 'browser-tests' }).recommended).toBe(primary.node);
	expect(placeTrackerWork(rows, { needsRamGB: 200 }).recommended).toBeNull();
	const cpuBusy = row(primary.node, { ...primary.sample, cpu_busy_pct: 80 });
	expect(placeTrackerWork([cpuBusy, mb2], { kind: 'browser-tests' }).recommended).toBe(mb2.node);
	const reserved = new Map([[primary.node, { cores: 12, ramGB: 4 }]]);
	expect(placeTrackerWork(rows, { kind: 'browser-tests', reserved }).recommended).toBe(mb2.node);
	const samples = Array.from({ length: 4 }, (_, pid) =>
		resourceSample(now, {
			top_cpu: [
				{
					pid,
					label: `test-runner pid ${pid}`,
					kind: 'test-runner',
					cpu: 250,
					rss_mb: 3072,
					procs: 4
				}
			]
		})
	);
	expect(trackerObservedDemand('browser-tests', samples)).toEqual({ cores: 2.5, ramGB: 3 });
	expect(trackerObservedDemand('codex', samples)).toEqual({ cores: 0.25, ramGB: 1.5 });
	const busyPrimary = row(primary.node, {
		cores: 18,
		load: [22, 28.2, 25],
		cpu_busy_pct: 75,
		ram: {
			total_mb: 36_864,
			used_mb: 29_491,
			available_mb: 7373,
			available_pct: 20,
			pressure_free_pct: 42
		}
	});
	const mb2WithHeadroom = row(mb2.node, {
		load: [5.4, 5.4, 5.4],
		cpu_busy_pct: 15,
		ram: { total_mb: 65_536, used_mb: 19_456, available_mb: 46_080, available_pct: 70 }
	});
	const learned = { kind: 'codex' as const, needsRamGB: 0.6, needsCores: 0.19 };
	const placement = placeTrackerWork([busyPrimary, mb2WithHeadroom], learned);
	expect(placement.ranked.every(({ fits }) => fits)).toBe(true);
	expect(placement.recommended).toBe(mb2.node);
	const memoryBusy = row(mb2.node, {
		ram: { total_mb: 65_536, used_mb: 49_152, available_mb: 16_384, available_pct: 25 }
	});
	expect(placeTrackerWork([primary, memoryBusy], { kind: 'codex' }).recommended).toBe(primary.node);
});

test('never recommends an overloaded or offline computer', () => {
	const offline = {
		node: 'harbor-mbp-2',
		role: 'runner' as const,
		...trackerMachineStatus(null, [], now),
		sample: null
	};
	const busy = row('daniel-primary-mbp', { load: [20, 20, 20] });
	const placement = placeTrackerWork([offline, busy]);
	expect(placement.recommended).toBeNull();
	expect(placeTrackerWork([offline, busy], { kind: 'codex' }).recommended).toBe(
		'daniel-primary-mbp'
	);
	expect(placeTrackerWork([offline, busy], { kind: 'browser-tests' }).recommended).toBeNull();
	expect(placement.ranked.at(-1)).toMatchObject({ node: 'harbor-mbp-2', score: null });
});
