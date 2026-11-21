import { expect, test } from 'vitest';
import { chooseResourceHost } from '../../../src/services/execution-runtimes/resource-placement/chooseResourceHost';
import { NOW, host, policy, runner, snapshot, work } from '../../support/resourcePlacementFixture';

const choose = (
	hosts: Parameters<typeof chooseResourceHost>[0]['hosts'],
	request = work(),
	reservations: Parameters<typeof chooseResourceHost>[0]['reservations'] = []
) => chooseResourceHost({ hosts, work: request, reservations, policy, now: NOW });

test('heavy build work goes to the primary computer, which gets the heavy preference', () => {
	const choice = choose(
		[host('runner', 'runner', {}), host('mac', 'primary', {})],
		work({ kind: 'build', heavy: true, cli: null })
	);
	expect(choice.node).toBe('mac');
	expect(choice.why).toMatch(/^heavy build; /);
});

test('light general work goes to the shared box', () => {
	const choice = choose(
		[host('mac', 'primary', {}), host('grok-box', 'shared', {})],
		work({ kind: 'general', light: true, cli: null, request: { cpus: 1, memoryMiB: 1024 } })
	);
	expect(choice.node).toBe('grok-box');
	expect(choice.why).toMatch(/^light general; /);
});

test('an explicit due computer wins even when another computer scores higher', () => {
	const choice = choose(
		[host('runner', 'runner', {}), host('mac', 'primary', {})],
		work({ due: true, requestedNode: 'mac' })
	);
	expect(choice.node).toBe('mac');
});

test('an explicit due computer that is overloaded is not replaced; the reason is kept', () => {
	const choice = choose(
		[
			host('mac', 'primary', { snapshot: snapshot({ cpuAvailableCores: 0.5 }) }),
			host('runner', 'runner', {})
		],
		work({ due: true, requestedNode: 'mac' })
	);
	expect(choice.node).toBeNull();
	expect(choice.why).toContain('mac: overloaded: CPU reserve is exhausted');
	expect(choice.why).toContain('runner: not the requested computer (mac)');
});

test('a stale computer is refused as offline and nothing else is available', () => {
	const choice = choose([
		host('mac', 'primary', { snapshot: snapshot({ sampledAt: NOW - 6 * 60_000 }) })
	]);
	expect(choice).toEqual({ node: null, why: 'mac: offline (no sample for 6 min)' });
});

test('no computers at all gives the Tracker wording for no runner', () => {
	expect(choose([])).toEqual({ node: null, why: 'no runner available' });
});

test('a per-provider quota hold moves Codex work to another computer', () => {
	const choice = choose(
		[
			host('mac', 'primary', { runner: runner({ quotaHolds: { codex: 'resets 09:00' } }) }),
			host('runner', 'runner', {})
		],
		work({ kind: 'codex', cli: 'codex' })
	);
	expect(choice.node).toBe('runner');
});

test('the MB2 non-home cap sends other work to the primary computer', () => {
	const choice = choose(
		[
			host('mb2', 'runner', {
				runner: runner({ homeProjects: ['harbor'], otherMax: 1, otherActiveSessions: 1 })
			}),
			host('mac', 'primary', {})
		],
		work({ project: 'tracker', kind: 'claude', cli: 'claude' })
	);
	expect(choice.node).toBe('mac');
});

test('a reservation made earlier in the same round counts against capacity', () => {
	const hosts = [
		host('mac', 'primary', { runner: runner({ maxConcurrent: 1 }) }),
		host('runner', 'runner', {})
	];
	const choice = choose(hosts, work({ kind: 'codex', cli: 'codex' }), [
		{ node: 'mac', project: 'harness' }
	]);
	expect(choice.node).toBe('runner');
});
