import { afterEach, beforeEach, expect, test } from 'vitest';
import { insertItem, NOW, trackerReadFixture } from './trackerItemReadFixture';

let fixture: ReturnType<typeof trackerReadFixture>;

beforeEach(() => {
	fixture = trackerReadFixture();
});

afterEach(() => fixture.database.close());

test('every agent gets one line with its counts, soonest ETA and latest human note', () => {
	const add = (id: string, fields: Record<string, string | null>) =>
		insertItem(fixture.database, { id, title: `Item ${id}`, ...fields });
	add('pj0001', { agent: 'alpha', status: 'in_progress', due: '2026-07-01T10:00:00.000Z' });
	add('pj0002', { agent: 'alpha', status: 'in_progress', due: '2026-07-04T10:00:00.000Z' });
	add('pj0003', { agent: 'snoozed', remind_at: '2026-08-01T00:00:00.000Z' });
	add('pj0004', { agent: null, project: 'named-project', status: 'blocked' });
	add('pj0005', { agent: null });
	add('pj0006', { agent: 'finished', status: 'done' });
	add('pj0007', { agent: 'late', status: 'in_progress', due: '2026-06-30' });
	setProjectActivity();
	const { projects, launch_holds: holds } = fixture.repository.digest(NOW);
	expect(holds).toEqual([
		expect.objectContaining({
			id: 'pj0005',
			reason: 'Legacy automatic launch pause',
			until: '2026-07-02T08:00:00.000Z'
		})
	]);
	expect(projects.map(({ project }) => project)).toEqual([
		'alpha',
		'fixture-agent',
		'late',
		'named-project',
		'snoozed',
		'unassigned'
	]);
	expect(projects[0]).toMatchObject({
		in_progress: 2,
		blocked: 0,
		open: 0,
		eta: { id: 'pj0002', due: '2026-07-04T10:00:00.000Z', overdue: false },
		latest_note: { id: 'pj0001', at: '2026-07-01T08:00:00.000Z' }
	});
	const text = fixture.repository.digestText(NOW);
	expect(text).toContain('Legacy automatic launch pause');
	const line = text.split('\n').find((value) => value.startsWith('  - alpha:'))!;
	expect(line).toContain('latest 2026-07-01 [pj0001]: Tests pass. detail');
	expect(line.endsWith('…')).toBe(true);
	expect(line.length).toBeLessThan(260);
	expect(text).toContain(
		'  - late: 1 in progress, 0 blocked, 0 open · ETA 2026-06-30 [pj0007] (overdue)'
	);
	expect(text).toContain('  - snoozed: 0 in progress, 0 blocked, 1 open · no ETA or note');
});

function setProjectActivity() {
	const note = fixture.database.prepare(
		'INSERT INTO item_notes (item_id, hlc, node, text) VALUES (?, ?, ?, ?)'
	);
	const hlc = (at: string) => `${String(Date.parse(at)).padStart(15, '0')}-000000-n`;
	fixture.database
		.prepare("UPDATE items SET schedule_off = '1', clocks = ? WHERE id = 'pj0005'")
		.run(JSON.stringify({ schedule_off: hlc('2026-07-01T08:00:00Z') }));
	note.run('pj0001', hlc('2026-07-01T08:00:00Z'), 'n', `Tests pass.\n${'detail '.repeat(60)}`);
	note.run('pj0002', hlc('2026-07-01T09:00:00Z'), 'n', 'watchdog missing: no live run');
	note.run('pj0002', hlc('2026-07-01T09:01:00Z'), 'n', 'auto-launch turned off');
	note.run('pj0002', hlc('2026-07-01T09:02:00Z'), 'n', 'Closed idle tmux session auto-x');
}

test('To unblock lists unflagged blockers only when the blocker is Daniel', () => {
	const reasons: Record<string, [string, boolean]> = {
		ub0001: ['Waiting on Daniel (CanBoat exam and survey).', true],
		ub0002: ["CoS triage: designs published; waiting on Daniel's design review.", true],
		ub0003: ["Rollout awaits the SDK handoffs and Daniel's legacy Electron decision.", true],
		ub0004: ['Waiting on one combined physical phone pairing session with Daniel.', true],
		ub0005: ['PR needs green main or Daniel approval of the exact head.', true],
		ub0006: ['Daniel to add the webhook signing key in the dashboard.', true],
		ub0007: ['MB2 SSH sudo requires a password. Add the folder in System Settings.', true],
		ub0008: ['Live webhook needs dashboard setup.', true],
		ub0009: ['Paused per Daniel. Resume when attested servers join.', false],
		ub0010: ["Waits on a browser fix; Daniel's 11:07 approval stands.", false],
		ub0011: ['Waiting for an MB2 sign-in route; no Daniel click needed.', false],
		ub0012: ['Held per Daniel/CoS until the verification clears.', false],
		ub0013: ["Blocked on a staging key. Resume: one probe, then ask Daniel's go.", false],
		ub0014: ['Waiting on box SSH recovery, item 1mtpc4.', false],
		ub0015: ['Waiting on the Daniel-approved deploy to finish.', false],
		ub0017: ['The checklist is pending a desktop host. No action needed from Daniel.', false]
	};
	for (const [id, [reason]] of Object.entries(reasons))
		insertItem(fixture.database, {
			id,
			title: `Blocked ${id}`,
			status: 'blocked',
			blocked_reason: reason
		});
	insertItem(fixture.database, {
		id: 'ub0016',
		title: 'Parked',
		status: 'blocked',
		blocked_reason: 'Waiting on Daniel.',
		parked_until: '2026-08-01T00:00:00.000Z'
	});
	const digest = fixture.repository.digest(NOW);
	const expected = Object.entries(reasons)
		.filter(([, [, daniel]]) => daniel)
		.map(([id]) => id);
	expect(digest.to_unblock.map(({ id }) => id)).toEqual(expected);
	expect(fixture.repository.digestText(NOW)).toContain(
		'  - [ub0001] Blocked ub0001 - blocked: Waiting on Daniel (CanBoat exam and survey).'
	);
});

test('Phase 4 module workers collapse into one Harness line without hiding Daniel actions', () => {
	const worker = (id: string, fields: Record<string, string | number>) =>
		insertItem(fixture.database, { id, agent: 'harness-worker-nodes', title: '', ...fields });
	worker('p40001', {
		title: 'Phase 4 states and tests: reports.input (p4.reports.input)',
		status: 'blocked',
		blocked_reason: 'Baseline repair'
	});
	worker('p40002', {
		title: 'Phase 4 verification batch A',
		owner: 'Harness Phase 4 Haiku',
		agent: 'harness',
		status: 'blocked',
		due: '2026-06-30'
	});
	worker('p40003', {
		title: 'Phase 4 visual states: design (p4.desktop.design)',
		status: 'in_progress',
		needs_daniel: 1,
		question: 'Approve the design?',
		options: JSON.stringify([
			{ label: 'Approve', effect: '', recommended: true },
			{ label: 'Hold', effect: '' }
		])
	});
	insertItem(fixture.database, {
		id: 'p4lead',
		title: 'Harness Phase 4 finish: orchestrator',
		owner: 'Harness: Phase 4 finish',
		agent: 'harness',
		status: 'blocked'
	});
	const digest = fixture.repository.digest(NOW);
	expect(digest.projects.find(({ project }) => project === 'harness')).toMatchObject({
		in_progress: 1,
		blocked: 3,
		open: 0,
		phase4_workers: { total: 3, in_progress: 1, blocked: 2, open: 0 }
	});
	expect(digest.projects.map(({ project }) => project)).not.toContain('harness-worker-nodes');
	expect(digest.blocked).toHaveLength(4);
	const text = fixture.repository.digestText(NOW);
	expect(text).toContain(
		'  - harness: 1 in progress, 3 blocked, 0 open (incl. 3 Phase 4 workers: 1 in progress, 2 blocked, 0 open)'
	);
	expect(text).toContain('[p4lead] Harness Phase 4 finish');
	expect(text).toContain('  - Harness Phase 4 workers (2): p40001, p40002');
	expect(text).not.toContain('[p40001]');
	expect(text).not.toContain('[p40002]');
	expect(text.slice(text.indexOf('To unblock (Daniel)'))).toContain(
		'[p40003] Phase 4 visual states: design (p4.desktop.design) - Q: Approve the design?'
	);
});

test('pings are separate from Daniel decisions, collapsed, and never hide an old decision', () => {
	fixture.database.prepare("UPDATE items SET options = ? WHERE id = 'abc100'").run(
		JSON.stringify([
			{ label: 'Approve', effect: '', recommended: true },
			{ label: 'Hold', effect: '' }
		])
	);
	const ping = (id: string, hours: number) =>
		insertItem(fixture.database, {
			id,
			title: `Worker ${id}`,
			status: 'in_progress',
			needs_daniel: 1,
			question: `daniel-primary-mbp: Session auto-${id}-r1 is idle again after a watchdog check-in. Chief of Staff, please inspect the session.`,
			clocks: JSON.stringify({
				needs_daniel: `${String(NOW - hours * 3_600_000).padStart(15, '0')}-000000-n`
			})
		});
	for (const [index, id] of ['pa0001', 'pa0002', 'pa0003', 'pa0004', 'pa0005', 'pa0006'].entries())
		ping(id, index);
	const digest = fixture.repository.digest(NOW);
	expect(digest.pings.map(({ id }) => id)).toEqual([
		'pa0006',
		'pa0005',
		'pa0004',
		'pa0003',
		'pa0002',
		'pa0001'
	]);
	expect(digest.daniel_decisions.map(({ id }) => id)).toEqual(['abc100']);
	expect(digest.needs_options.map(({ id }) => id)).toEqual(['abc200']);
	expect(digest.counts).toMatchObject({ needs_daniel: 8, daniel_decisions: 1, pings: 6 });
	const text = fixture.repository.digestText(NOW);
	expect(text).toContain('CoS/WORKER PINGS (6)');
	expect(text).toContain('  ... and 1 more');
	expect(text).not.toMatch(/NEEDS DANIEL \(\d+\)\n/);
	expect(text.slice(text.indexOf('To unblock (Daniel)'))).not.toContain('pa000');
});
