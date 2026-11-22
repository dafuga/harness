import { expect, test } from 'vitest';
import { mib } from '../../../src/core/execution-runtimes/resourceTypes';
import { classifyResourceHost } from '../../../src/services/execution-runtimes/resource-placement/classifyResourceHost';
import { NOW, host, policy, snapshot } from '../../support/resourcePlacementFixture';

const classify = (changes: Parameters<typeof snapshot>[0]) =>
	classifyResourceHost(host('mac', 'primary', { snapshot: snapshot(changes) }), policy, NOW);

test('a computer that never reported is offline, as in the Tracker', () => {
	expect(classifyResourceHost(host('mb2', 'runner', { snapshot: null }), policy, NOW)).toEqual({
		status: 'offline',
		reasons: ['never reported a sample'],
		ageMs: null
	});
});

test('a sample older than five minutes is a stale offline state', () => {
	const stale = classifyResourceHost(
		host('mac', 'primary', { snapshot: snapshot({ sampledAt: NOW - 6 * 60_000 }) }),
		policy,
		NOW
	);
	expect(stale.status).toBe('offline');
	expect(stale.reasons).toEqual(['no sample for 6 min']);
	expect(classify({ sampledAt: NOW - 4 * 60_000 }).status).toBe('ok');
});

test('an unavailable or future-dated sample is offline, not overloaded', () => {
	expect(classify({ status: 'unavailable', reason: 'probe failed' })).toMatchObject({
		status: 'offline',
		reasons: ['probe failed']
	});
	expect(classify({ sampledAt: NOW + 5000 })).toMatchObject({
		status: 'offline',
		reasons: ['Resource telemetry is unavailable or stale']
	});
	expect(classify({ usableCores: 0 })).toMatchObject({
		status: 'offline',
		reasons: ['Invalid resource telemetry']
	});
});

test('exhausted Harness CPU or memory reserves make a computer overloaded', () => {
	expect(classify({ cpuAvailableCores: 0.5 })).toMatchObject({
		status: 'overloaded',
		reasons: ['CPU reserve is exhausted']
	});
	expect(classify({ memoryAvailableBytes: 1.5 * 1024 * mib })).toMatchObject({
		status: 'overloaded',
		reasons: ['Memory reserve is exhausted']
	});
	expect(classify({ memoryPressure: 'critical' })).toMatchObject({
		status: 'overloaded',
		reasons: ['Memory pressure is critical']
	});
});

test('warning pressure overloads the computer while limited idle CPU makes it busy', () => {
	expect(classify({ memoryPressure: 'warning' })).toEqual({
		status: 'overloaded',
		reasons: ['Memory pressure is warning'],
		ageMs: 0
	});
	expect(classify({ cpuAvailableCores: 2 })).toMatchObject({
		status: 'busy',
		reasons: ['8 of 10 cores busy']
	});
	expect(classify({ cpuAvailableCores: 3 }).status).toBe('ok');
});
