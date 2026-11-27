import { expect, test } from 'vitest';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';
import { assignTrackerLaunches } from '../../../src/services/projects-sessions/tracker-machine-service/assignTrackerLaunches';
import { resourceSample } from '../../support/trackerMachineFixture';
import {
	call,
	exchange,
	fleet,
	hubNode,
	minute,
	peerNode,
	report
} from '../../support/trackerFleetFixture';

test('both computers see each other in machines, place and status', async () => {
	const nodes = fleet();
	try {
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
			const placed = await call(runtime, ['place', '--kind', 'claude']);
			expect(placed.data.recommended).toBe(peerNode);
			expect(placed.text).toContain('use harbor-mbp-2 (claude, needs 2 GB)');
		}
		const detail = await call(nodes.hub, ['machines', 'mb2', '--hours', '1']);
		expect(detail.data.history.length).toBeGreaterThan(0);
		expect(detail.text).toContain('history:');
		expect((await call(nodes.hub, ['machines', 'nowhere'])).status).toBe(404);
		expect((await call(nodes.hub, ['place', '--kind', 'gpu'])).status).toBe(400);
		expect(() => nativeTrackerArgs(['machines', '--hours', '2'])).toThrow('usage');
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
			load: [20, 20, 20],
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
		expect(nodes.hub.machines.rows().find(({ node }) => node === peerNode)?.status).toBe('busy');
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
		expect(alert.reason).toContain('claude in tmux:auto-a-r1');
		expect(alert.reason).toContain(`Suggested move: claude in tmux:auto-a-r1 to ${hubNode}`);
		nodes.readings[peerNode] = {};
		await advance(2);
		expect(nodes.hub.machines.rows().find(({ node }) => node === peerNode)).toMatchObject({
			status: 'ok',
			reasons: []
		});
		await advance(11);
		expect(await items()).toMatchObject([{ status: 'done' }]);
		expect(nodes.hub.watchdog!.alerts()).toEqual([]);
		nodes.readings[peerNode] = {
			load: [220, 20, 1],
			system_cpu: [
				{ label: 'iOS Simulator', pid: 50, procs: 45, cpu: 750, rss_mb: 3000 },
				{ label: 'Orphaned Harness test helpers', pid: 60, procs: 56, cpu: 100, rss_mb: 600 }
			],
			system_rss: [{ label: 'Memory-heavy process', pid: 70, procs: 1, cpu: 0, rss_mb: 8000 }]
		};
		nodes.readings[hubNode] = {
			ram: { ...resourceSample(nodes.clock.at).ram, pressure: 'warn' }
		};
		const box = resourceSample(nodes.clock.at).disks[0];
		for (let passed = 0; passed < 4; passed++) {
			await exchange(nodes, {
				...report(nodes, 'grok-box', []),
				resources: resourceSample(nodes.clock.at, {
					platform: 'linux',
					disks: [{ ...box, mount: '/', free_gb: 12 }],
					disk_users: [{ label: 'Harness state and worktrees', used_gb: 85 }]
				})
			});
			await advance(1);
		}
		const incident = nodes.hub.watchdog!.alerts();
		expect(incident).toHaveLength(3);
		expect(incident).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					host: peerNode,
					reason: expect.stringContaining('System load 22× capacity')
				}),
				expect.objectContaining({
					host: hubNode,
					reason: expect.stringContaining('Memory nearly full')
				}),
				expect.objectContaining({
					host: 'grok-box',
					reason: expect.stringContaining('12 GB free on /')
				})
			])
		);
		const spike = incident.find(({ host }) => host === peerNode)?.reason;
		expect(spike).toContain(
			'Top CPU: iOS Simulator (750%, 45 procs), Orphaned Harness test helpers'
		);
		expect(spike).toContain('Top memory: Memory-heavy process (8000 MB)');
		expect(incident.find(({ host }) => host === 'grok-box')?.reason).toContain(
			'Largest sampled disk users: Harness state and worktrees (85 GB)'
		);
		expect((await items()).every(({ needs_daniel }) => !needs_daniel)).toBe(true);
	} finally {
		nodes.close();
	}
});

test('a peer that stops reporting or is overloaded loses its due-start grant', async () => {
	const nodes = fleet();
	try {
		expect(nodes.hub.machines.peerStartHold(peerNode)).toBeNull();
		await nodes.tick();
		expect(nodes.hub.machines.peerStartHold(peerNode)).toBeNull();
		nodes.clock.at += 3 * minute;
		expect(nodes.hub.machines.peerStartHold(peerNode)).toBe('no fresh machine sample');
		nodes.readings[peerNode] = { load: [40, 40, 40] };
		await nodes.tick();
		expect(nodes.hub.machines.peerStartHold(peerNode)).toContain('load above the start limit');
		nodes.clock.at += minute;
		await nodes.tick();
		expect(nodes.hub.machines.peerStartHold(peerNode)).toContain('is overloaded');
	} finally {
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
		await exchange(nodes, report(nodes, peerNode, ['harbor']));
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
			samples: () => [report(nodes, peerNode, ['harbor'])]
		};
		assignTrackerLaunches(view);
		const shown = (await call(nodes.hub, ['show', id])).data;
		expect(shown).toMatchObject({ computer: peerNode, launch_target: peerNode });
		expect(shown.notes_log.at(-1).text).toContain('auto-launch: assigned to harbor-mbp-2');
	} finally {
		nodes.close();
	}
});
