import { expect, test, vi } from 'vitest';
import { TrackerTmuxAdapter } from '../../../src/adapters/projects-sessions/TrackerTmuxAdapter';
import { randomUUID } from 'node:crypto';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';
import { assignTrackerLaunches } from '../../../src/services/projects-sessions/tracker-machine-service/assignTrackerLaunches';
import {
	call,
	checkRemoteWork,
	exchangeFleetReport,
	fleet,
	fleetReport,
	hostLease,
	hubNode,
	minute,
	originRun,
	peerNode,
	signal
} from '../../support/trackerFleetFixture';

vi.mock(
	'../../../src/services/projects-sessions/tracker-native-runtime-service/trackerWatchdogPeer',
	() => ({ readTrackerWatchdogPeer: async () => [] })
);

test('both computers see each other in machines, place and status', async () => {
	const nodes = fleet();
	try {
		nodes.readings[hubNode] = {
			cores: 18,
			ram: { total_mb: 36_864, used_mb: 8192, available_mb: 28_672, available_pct: 78 }
		};
		await nodes.tick();
		nodes.clock.at += minute;
		await nodes.tick();
		for (const runtime of [nodes.hub, nodes.peer]) {
			const { data, text } = await call(runtime, ['machines']);
			expect(
				data.map(({ node, status }: { node: string; status: string }) => [node, status])
			).toEqual([
				[hubNode, 'ok'],
				['grok-box', 'offline'],
				[peerNode, 'ok']
			]);
			expect(text).toContain('harbor-mbp-2  OK  (runner)');
			expect(data.find(({ node }: { node: string }) => node === peerNode).utilization).toEqual({
				actual: { cpu: 5, ram: 25 },
				target: { cpu: 80, ram: 75 }
			});
			const placed = await call(runtime, ['place', '--kind', 'claude']);
			expect(placed.data.recommended).toBe(peerNode);
			expect(placed.text).toContain('use harbor-mbp-2 (claude, needs 2 GB)');
			const heavy = await call(runtime, ['place', '--kind', 'build']);
			expect(heavy.data).toMatchObject({ recommended: hubNode, needs_cores: 5, needs_ram_gb: 4 });
		}
		const detail = await call(nodes.hub, ['machines', 'mb2', '--hours', '1']);
		expect(detail.data.history.length).toBeGreaterThan(0);
		expect(detail.text).toContain('history:');
		expect((await call(nodes.hub, ['machines', 'nowhere'])).status).toBe(404);
		expect((await call(nodes.hub, ['place', '--kind', 'gpu'])).status).toBe(400);
		expect(() => nativeTrackerArgs(['machines', '--hours', '2'])).toThrow('usage');
		await checkRemoteWork(nodes);
	} finally {
		nodes.close();
	}
});

test('raises one Chief of Staff alert for a sustained overload and closes it when calm', async () => {
	const nodes = fleet({
		// Never run here. A CI runner's own Node binary may be writable by others and is refused.
		hostEffects: { watchdog: { tmux: '/bin/sh', chiefOfStaff: true } }
	});
	const advance = async (minutes: number) => {
		for (let passed = 0; passed < minutes; passed++) {
			nodes.clock.at += minute;
			await nodes.tick();
		}
	};
	const items = async () =>
		(await call(nodes.hub, ['list', '--status', 'all'])).data as {
			title: string;
			status: string;
			needs_daniel: boolean;
			auto: string | null;
		}[];
	try {
		nodes.readings[peerNode] = {
			load: [30, 30, 30],
			top_cpu: [
				{
					kind: 'claude',
					pid: 7,
					label: 'claude in tmux:auto-a-r1',
					procs: 3,
					cpu: 800,
					rss_mb: 900
				}
			]
		};
		await advance(9);
		expect(await items()).toEqual([]);
		await advance(4);
		const [raised, ...others] = await items();
		expect(others).toEqual([]);
		expect(raised).toMatchObject({
			title: 'Computer overloaded: harbor-mbp-2',
			needs_daniel: false,
			auto: null
		});
		const [alert] = nodes.hub.watchdog!.alerts();
		expect(alert).toMatchObject({ kind: 'overload', host: peerNode });
		expect(alert.reason).toContain('Heaviest: claude in tmux:auto-a-r1');
		expect(alert.reason).toContain(`Suggested move: claude in tmux:auto-a-r1 to ${hubNode}`);
		nodes.readings[peerNode] = {};
		await advance(13);
		expect(await items()).toMatchObject([{ status: 'done' }]);
		expect(nodes.hub.watchdog!.alerts()).toEqual([]);
	} finally {
		nodes.close();
	}
});

test('a peer that stops reporting loses its due-start grant and alerts Chief of Staff once', async () => {
	const nodes = fleet({ hostEffects: { watchdog: { tmux: '/bin/sh', chiefOfStaff: true } } });
	const scan = vi
		.spyOn(TrackerTmuxAdapter.prototype, 'scan')
		.mockImplementation(async (_, names) => (names?.test('cos') ? [{} as never] : []));
	const nudge = vi.spyOn(TrackerTmuxAdapter.prototype, 'nudge').mockResolvedValue(true);
	const clock = vi.spyOn(Date, 'now').mockImplementation(() => nodes.clock.at);
	try {
		expect(nodes.hub.machines.peerStartHold(peerNode)).toBeNull();
		await nodes.tick();
		expect(nodes.hub.machines.peerStartHold(peerNode)).toBeNull();
		const claim = { run: originRun(nodes.peer), lease: randomUUID(), host: hubNode, kind: 'ssh' };
		expect((await hostLease(nodes.peer, 'POST', claim)).status).toBe(200);
		await nodes.tick();
		expect((await call(nodes.hub, ['machines', 'mac'])).data.remote_runs).toBe(1);
		expect((await hostLease(nodes.peer, 'DELETE', claim)).status).toBe(200);
		await nodes.tick();
		expect((await call(nodes.hub, ['machines', 'mac'])).data.remote_runs).toBe(0);
		await exchangeFleetReport(nodes, fleetReport(nodes, peerNode, ['harbor']));
		nodes.clock.at += 3 * minute;
		expect(nodes.hub.machines.peerStartHold(peerNode)).toBe('no fresh machine sample');
		expect(nodes.hub.watchdog!.alerts()).toEqual([]);
		nodes.clock.at += minute;
		await nodes.hub.watchdog!.tick(signal);
		expect(nodes.hub.watchdog!.alerts()).toMatchObject([
			{ host: peerNode, kind: 'stale-dispatch-heartbeat' }
		]);
		expect(nudge).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ message: expect.stringContaining(peerNode) }),
			signal
		);
		nodes.clock.at += minute;
		await nodes.hub.watchdog!.tick(signal);
		expect(nudge).toHaveBeenCalledTimes(1);
		await exchangeFleetReport(nodes, fleetReport(nodes, peerNode, ['harbor']));
		expect(nodes.hub.watchdog!.alerts()).toEqual([]);
		nodes.readings[peerNode] = { load: [23, 23, 5] };
		await nodes.tick();
		expect(nodes.hub.machines.peerStartHold(peerNode)).toBeNull();
	} finally {
		clock.mockRestore();
		nudge.mockRestore();
		scan.mockRestore();
		nodes.close();
	}
});

test('--computer auto picks the computer whose launcher maps the project', async () => {
	const nodes = fleet({
		planLaunch: (fields) => ({
			...fields,
			computer: fields.computer ?? hubNode,
			launch_target: fields.computer ?? hubNode
		})
	});
	try {
		await nodes.tick();
		const add = async (...extra: string[]) =>
			(await call(nodes.hub, ['add', `Fixture ${extra.join(' ')}`, '--auto', '--force', ...extra]))
				.data;
		const busy = fleetReport(nodes, peerNode, ['harbor']);
		busy.resources.load = [23, 23, 5];
		await exchangeFleetReport(nodes, busy);
		expect(await add('--agent', 'harbor', '--computer', 'auto')).toMatchObject({
			computer: peerNode
		});
		expect(await add('--agent', 'unmapped', '--computer', 'auto')).toMatchObject({
			computer: 'auto'
		});
		expect(await add('--agent', 'harbor')).toMatchObject({ computer: hubNode });
	} finally {
		nodes.close();
	}
});

test('the hub assigns a launch with no computer to the peer that can run it', async () => {
	const nodes = fleet();
	try {
		await nodes.tick();
		const { id } = (await call(nodes.hub, ['add', 'Fixture task', '--agent', 'harbor'])).data;
		nodes.hub.store.appendLocal({ itemId: id, fields: { auto: 'fixture-token' } });
		const view = {
			machines: nodes.hub.machines,
			now: () => nodes.clock.at,
			samples: () => [fleetReport(nodes, peerNode, ['harbor'])]
		};
		assignTrackerLaunches(view);
		const shown = (await call(nodes.hub, ['show', id])).data;
		expect(shown).toMatchObject({ computer: peerNode, launch_target: peerNode });
		expect(shown.notes_log.at(-1).text).toContain('auto-launch: assigned to harbor-mbp-2');
	} finally {
		nodes.close();
	}
});
