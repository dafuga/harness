import { expect, test } from 'vitest';
import { mib } from '../../../src/core/execution-runtimes/resourceTypes';
import type {
	ResourceHost,
	ResourceReservation,
	ResourceWork
} from '../../../src/core/execution-runtimes/resourcePlacementTypes';
import { admitResourceHost } from '../../../src/services/execution-runtimes/resource-placement/admitResourceHost';
import { classifyResourceHost } from '../../../src/services/execution-runtimes/resource-placement/classifyResourceHost';
import { scoreResourceHost } from '../../../src/services/execution-runtimes/resource-placement/scoreResourceHost';
import { NOW, host, policy, runner, snapshot, work } from '../../support/resourcePlacementFixture';

/** Admission of one host with its scored candidate, as the chooser calls it. */
function admit(
	target: ResourceHost,
	request: ResourceWork,
	reservations: ResourceReservation[] = []
): string | null {
	const candidate = scoreResourceHost(
		target,
		request,
		classifyResourceHost(target, policy, NOW),
		policy
	);
	return admitResourceHost(target, request, candidate, reservations);
}

const mb2 = (changes: Parameters<typeof runner>[0]) =>
	host('mb2', 'runner', { runner: runner({ homeProjects: ['harbor'], ...changes }) });

test('a due launch for an explicit computer is admitted only on that computer', () => {
	const due = work({ due: true, requestedNode: 'harbor-mbp-2' });
	expect(admit(host('mac', 'primary', {}), due)).toBe('not the requested computer (harbor-mbp-2)');
	expect(admit(host('harbor-mbp-2', 'runner', {}), due)).toBeNull();
});

test('the shared box takes only light due work, and heavy non-due work is not held', () => {
	const shared = host('grok-box', 'shared', {});
	expect(admit(shared, work({ due: true, heavy: true, kind: 'build' }))).toBe(
		'shared box is reserved for light work'
	);
	expect(admit(shared, work({ due: true, light: true, kind: 'general' }))).toBeNull();
	expect(admit(shared, work({ heavy: true, kind: 'build' }))).toBeNull();
});

test('a disabled launcher is named; an offline or unsampled one has no fresh sample', () => {
	const disabled = host('mac', 'primary', { runner: runner({ enabled: false }) });
	expect(admit(disabled, work())).toBe('launcher disabled');
	const unsampled = host('mac', 'primary', { snapshot: null, runner: runner({ enabled: false }) });
	expect(admit(unsampled, work())).toBe('no fresh machine sample');
	const stale = host('mac', 'primary', {
		snapshot: snapshot({ sampledAt: NOW - 10 * 60_000 }),
		runner: runner({ enabled: false })
	});
	expect(admit(stale, work())).toBe('no fresh machine sample');
});

test('disk holds and per-provider quota holds block only the matching work', () => {
	const diskHeld = host('mac', 'primary', {
		runner: runner({ diskHold: 'only 3.1 GB disk free (need at least 5 GB)' })
	});
	expect(admit(diskHeld, work())).toBe('only 3.1 GB disk free (need at least 5 GB)');

	const claudeQuota = host('runner', 'runner', {
		runner: runner({ quotaHolds: { claude: 'resets 14:00' } })
	});
	expect(admit(claudeQuota, work())).toBe('claude quota exhausted');
	expect(admit(claudeQuota, work({ kind: 'codex', cli: 'codex' }))).toBeNull();

	const codexPaused = host('mac', 'primary', { runner: runner({ codexPaused: true }) });
	expect(admit(codexPaused, work({ kind: 'codex', cli: 'codex' }))).toBe('Codex paused');
	expect(admit(codexPaused, work())).toBeNull();
});

test('work needs a known project repository, or an explicitly mapped repository path', () => {
	const target = host('mac', 'primary', { runner: runner({ repoPaths: ['/work/harness'] }) });
	expect(admit(target, work({ project: 'unknown' }))).toBe('no repo for unknown');
	expect(admit(target, work({ repo: '/work/other' }))).toBe('explicit repo path unavailable');
	expect(admit(target, work({ repo: '/work/harness' }))).toBeNull();
});

test('a computer whose score says it does not fit is refused with that reason', () => {
	const tight = host('mac', 'primary', {
		snapshot: snapshot({ memoryAvailableBytes: 2.5 * 1024 * mib })
	});
	expect(admit(tight, work())).toBe('would leave 0.5 GB free (needs 2 GB, keeps 2 GB)');
});

test('capacity counts this computer’s running and reserved sessions, not the others', () => {
	const target = host('mac', 'primary', { runner: runner({ activeSessions: 1 }) });
	expect(admit(target, work(), [{ node: 'mac', project: 'harness' }])).toBe(
		'2/2 sessions running or reserved'
	);
	expect(admit(target, work(), [{ node: 'runner', project: 'harness' }])).toBeNull();
});

test('MB2 caps non-home work to one session, while home work is not capped', () => {
	const busy = mb2({ otherMax: 1, otherActiveSessions: 1, maxConcurrent: 4 });
	expect(admit(busy, work({ project: 'tracker' }))).toBe(
		'1/1 non-harbor sessions running or reserved'
	);
	expect(admit(busy, work({ project: 'harbor' }))).toBeNull();
	expect(
		admit(mb2({ otherMax: 1, maxConcurrent: 4 }), work({ project: 'tracker' }), [
			{ node: 'mb2', project: 'tracker' }
		])
	).toBe('1/1 non-harbor sessions running or reserved');
});

test('MB2 holds non-home work at four busy cores and within its CPU budget', () => {
	const loaded = host('mb2', 'runner', {
		snapshot: snapshot({ cpuAvailableCores: 6 }),
		runner: runner({ homeProjects: ['harbor'], otherMax: 2, otherLoadLimitCores: 4 })
	});
	expect(admit(loaded, work({ project: 'tracker' }))).toBe('load too high for non-harbor work');
	expect(admit(loaded, work({ project: 'harbor' }))).toBeNull();

	const budget = mb2({ otherMax: 2, otherCores: 4, otherCpuPercent: 350 });
	expect(admit(budget, work({ project: 'tracker' }))).toBe('non-harbor work at 350% of 4 cores');
});
