import { expect, test } from 'vitest';
import { placeTrackerWork } from '../../../src/utils/projects-sessions/placeTrackerWork';
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
	const high = { load: [43, 43, 43] };
	const moderate = { load: [20, 20, 20] };
	const sustained = Array.from({ length: 10 }, (_, index) =>
		resourceSample(now - (index + 1) * minute, moderate)
	);
	expect(status({ load: [1, 16, 1] }).status).toBe('busy');
	expect(status(high).status).toBe('busy');
	expect(status(high, [resourceSample(now - 3 * minute, high)]).status).toBe('busy');
	expect(status(high, [resourceSample(now - minute, high)])).toMatchObject({
		status: 'overloaded',
		reasons: ['System load 4.3× capacity']
	});
	expect(status(moderate, sustained.slice(0, -1)).status).toBe('busy');
	expect(status(moderate, sustained)).toMatchObject({
		status: 'overloaded',
		reasons: ['System load 2× capacity']
	});
	expect(
		status(
			moderate,
			sustained.filter((_, index) => index !== 5 && index !== 6)
		).status
	).toBe('busy');
	expect(status({ load: [1, 20, 20] }, sustained).status).toBe('busy');
	const ram = resourceSample(now).ram;
	expect(status({ ram: { ...ram, available_pct: 5 } }).status).toBe('overloaded');
	expect(status({ ram: { ...ram, available_pct: 5, pressure_free_pct: 60 } }).status).toBe('ok');
	expect(status({ ram: { ...ram, pressure: 'critical' } }).status).toBe('overloaded');
	const earlier = resourceSample(now - 9 * minute);
	expect(status({ swap: { total_mb: 2048, used_mb: 700 } }, [earlier]).status).toBe('busy');
	expect(trackerMachineStatus(resourceSample(now - 6 * minute), [], now).status).toBe('offline');
	expect(trackerMachineStatus(null, [], now).reasons).toEqual(['never reported a sample']);
});

test('absolute free space protects a disk; a low percentage alone does not', () => {
	const disk = { mount: '/', total_gb: 1000, free_gb: 60, free_pct: 6 };
	expect(status({ disks: [disk] }).status).toBe('ok');
	expect(status({ platform: 'linux', disks: [{ ...disk, free_gb: 25 }] }).status).toBe('busy');
	expect(status({ disks: [{ ...disk, free_gb: 59 }] }).status).toBe('overloaded');
	expect(status({ disks: [{ ...disk, free_gb: 60 }] }).status).toBe('ok');
	expect(status({ platform: 'linux', disks: [{ ...disk, free_gb: 59 }] }).status).toBe('ok');
	expect(status({ disks: [{ ...disk, free_gb: 19 }] }).status).toBe('overloaded');
});

test('places work by role, headroom and fit', () => {
	const rows = [
		row('daniel-primary-mbp'),
		row('harbor-mbp-2'),
		row('grok-box', {
			ram: { total_mb: 16_384, used_mb: 11_000, available_mb: 5000, available_pct: 30 }
		})
	];
	expect(placeTrackerWork(rows, { kind: 'claude' }).recommended).toBe('harbor-mbp-2');
	expect(placeTrackerWork(rows, { kind: 'codex' }).recommended).toBe('daniel-primary-mbp');
	const box = placeTrackerWork(rows).ranked.find(({ node }) => node === 'grok-box');
	expect(box).toMatchObject({ fits: false });
	expect(box?.reasons.join(' ')).toContain('keeps 4 GB');
	expect(placeTrackerWork(rows, { needsRamGB: 200 }).recommended).toBeNull();
	expect(
		placeTrackerWork(rows, { kind: 'claude', exclude: ['harbor-mbp-2'] }).recommended
	).not.toBe('harbor-mbp-2');
});

test('never recommends an overloaded or offline computer', () => {
	const offline = {
		node: 'harbor-mbp-2',
		role: 'runner' as const,
		...trackerMachineStatus(null, [], now),
		sample: null
	};
	const placement = placeTrackerWork([
		offline,
		row('daniel-primary-mbp', { ram: { ...resourceSample(now).ram, pressure: 'warn' } })
	]);
	expect(placement.recommended).toBeNull();
	expect(placement.ranked.at(-1)).toMatchObject({ node: 'harbor-mbp-2', score: null });
});
