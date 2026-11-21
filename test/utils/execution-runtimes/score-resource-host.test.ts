import { expect, test } from 'vitest';
import { mib } from '../../../src/core/execution-runtimes/resourceTypes';
import type { ResourceHostClassification } from '../../../src/core/execution-runtimes/resourcePlacementTypes';
import { scoreResourceHost } from '../../../src/services/execution-runtimes/resource-placement/scoreResourceHost';
import { host, policy, snapshot, work } from '../../support/resourcePlacementFixture';

const ok: ResourceHostClassification = { status: 'ok', reasons: [], ageMs: 0 };

test('an offline computer never fits and carries its classification reason', () => {
	const offline = scoreResourceHost(
		host('mac', 'primary', { snapshot: null }),
		work(),
		{ status: 'offline', reasons: ['no sample for 6 min'], ageMs: 360_000 },
		policy
	);
	expect(offline).toMatchObject({
		node: 'mac',
		fits: false,
		score: -Infinity,
		status: 'offline',
		reasons: expect.arrayContaining(['offline (no sample for 6 min)'])
	});
});

test('a computer that would leave less than its kept RAM does not fit', () => {
	const tight = scoreResourceHost(
		host('runner', 'runner', { snapshot: snapshot({ memoryAvailableBytes: 3 * 1024 * mib }) }),
		work({ request: { cpus: 1, memoryMiB: 2048 } }),
		ok,
		policy
	);
	expect(tight.fits).toBe(false);
	expect(tight.reasons).toContain('would leave 1 GB free (needs 2 GB, keeps 2 GB)');
});

test('a shared box that is busy does not fit, but a busy primary still does', () => {
	const busy: ResourceHostClassification = {
		status: 'busy',
		reasons: ['8 of 10 cores busy'],
		ageMs: 0
	};
	expect(
		scoreResourceHost(host('shared', 'shared', {}), work({ light: true }), busy, policy)
	).toMatchObject({ fits: false, reasons: expect.arrayContaining(['shared box is already busy']) });
	expect(scoreResourceHost(host('mac', 'primary', {}), work(), busy, policy).fits).toBe(true);
});

test('the Tracker score weights: CPU and RAM headroom, sessions, role preferences', () => {
	// Idle CPU and RAM headroom both 1 (50 + 50), a runner for Claude work (+30).
	const idle = scoreResourceHost(host('runner', 'runner', {}), work(), ok, policy);
	expect(idle).toMatchObject({ fits: true, score: 130, role: 'runner' });
	expect(idle.reasons).toContain('preferred for claude');

	const loaded = scoreResourceHost(
		host('runner', 'runner', { agentSessions: 2, heavyGroups: 1 }),
		work(),
		ok,
		policy
	);
	expect(loaded.score).toBe(130 - 6 - 5);
});

test('codex work prefers the primary computer; heavy work avoids it', () => {
	const primary = host('mac', 'primary', {});
	expect(
		scoreResourceHost(primary, work({ kind: 'codex', cli: 'codex' }), ok, policy)
	).toMatchObject({
		score: 125,
		reasons: expect.arrayContaining(['preferred for codex'])
	});
	expect(scoreResourceHost(primary, work({ kind: 'build', heavy: true }), ok, policy).score).toBe(
		100 - 20
	);
});
