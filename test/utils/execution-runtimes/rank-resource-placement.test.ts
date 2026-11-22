import { expect, test } from 'vitest';
import { rankResourcePlacement } from '../../../src/services/execution-runtimes/resource-placement/rankResourcePlacement';
import { NOW, host, policy, snapshot, work } from '../../support/resourcePlacementFixture';

test('fitting computers rank first by score and the best fit is recommended', () => {
	const placement = rankResourcePlacement(
		[
			host('mac', 'primary', {}),
			host('runner', 'runner', {}),
			host('mb2-offline', 'runner', { snapshot: null })
		],
		work(),
		policy,
		NOW
	);
	expect(placement).toMatchObject({ kind: 'claude', needsMemoryMiB: 2048, recommended: 'runner' });
	expect(placement.ranked.map((c) => [c.node, c.fits])).toEqual([
		['runner', true],
		['mac', true],
		['mb2-offline', false]
	]);
});

test('no fitting computer leaves the recommendation empty but keeps every candidate', () => {
	const placement = rankResourcePlacement(
		[
			host('mac', 'primary', { snapshot: snapshot({ memoryPressure: 'critical' }) }),
			host('runner', 'runner', { snapshot: snapshot({ cpuAvailableCores: 0.5 }) })
		],
		work(),
		policy,
		NOW
	);
	expect(placement.recommended).toBeNull();
	expect(placement.ranked.every((c) => !c.fits && c.status === 'overloaded')).toBe(true);
	const primary = placement.ranked.find((c) => c.node === 'mac');
	expect(primary?.reasons).toContain('overloaded: Memory pressure is critical');
});

test('a non-fitting computer ranks below a fitting one even with a higher preference', () => {
	const placement = rankResourcePlacement(
		[
			host('runner', 'runner', { snapshot: snapshot({ memoryPressure: 'critical' }) }),
			host('mac', 'primary', {})
		],
		work(),
		policy,
		NOW
	);
	expect(placement.ranked.map((c) => c.node)).toEqual(['mac', 'runner']);
	expect(placement.recommended).toBe('mac');
});

test('codex work is recommended on the primary computer, which keeps Codex sessions', () => {
	const placement = rankResourcePlacement(
		[host('runner', 'runner', {}), host('mac', 'primary', {})],
		work({ kind: 'codex', cli: 'codex' }),
		policy,
		NOW
	);
	expect(placement.recommended).toBe('mac');
});

/** Golden case: the Tracker 122e190 placement output for these three artificial computers. */
test('keeps the Tracker 122e190 placement results for the same artificial computers', () => {
	const mib = 1024 * 1024;
	const machine = (cores: number, busy: number, totalMiB: number, freeMiB: number) =>
		snapshot({
			logicalCores: cores,
			usableCores: cores,
			cpuAvailableCores: cores - busy,
			cpuUsedPercent: (busy / cores) * 100,
			memoryTotalBytes: totalMiB * mib,
			memoryAvailableBytes: freeMiB * mib
		});
	const placement = rankResourcePlacement(
		[
			host('daniel-primary-mbp', 'primary', {
				snapshot: machine(10, 2, 16384, 10240),
				agentSessions: 3
			}),
			host('harbor-mbp-2', 'runner', {
				snapshot: machine(8, 1, 32768, 20480),
				heavyGroups: 1
			}),
			host('grok-box', 'shared', {
				snapshot: machine(4, 3, 8192, 6144),
				agentSessions: 1
			})
		],
		work(),
		policy,
		NOW
	);
	expect(placement.recommended).toBe('harbor-mbp-2');
	expect(placement.ranked.map((c) => [c.node, c.fits, c.score, c.status])).toEqual([
		['harbor-mbp-2', true, 119, 'ok'],
		['daniel-primary-mbp', true, 69, 'ok'],
		['grok-box', true, -15, 'ok']
	]);
});
