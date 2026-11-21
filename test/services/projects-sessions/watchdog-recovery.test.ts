import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { WatchdogRecoveryService } from '../../../src/services/projects-sessions/WatchdogRecoveryService';
import type {
	RecoverySnapshot,
	ResumeSnapshot
} from '../../../src/services/projects-sessions/WatchdogRecoveryService.types';
import {
	clock,
	host,
	item,
	minute,
	now,
	pane,
	recordWatchdogOutcome,
	run
} from './watchdog-fixtures';

const service = new WatchdogRecoveryService();
const row = { ...item(), type: 'task', target: host } as const;
const input = {
	host,
	now,
	item: row,
	items: [row],
	panes: [],
	history: [],
	localRuns: [],
	launcherEnabled: true,
	repoExists: true,
	targeted: true
} satisfies RecoverySnapshot;
const blocked = run({ state: 'finished', outcome: 'blocked', endedAt: now - 2 * minute });
const answerAt = now - minute;
const answered = {
	...item({ status: 'blocked', resolved: true }),
	answeredAt: 'fixture answer',
	clocks: { answer: clock(answerAt), question: clock(answerAt - 2), status: clock(answerAt - 1) }
};
const resume = {
	now,
	item: answered,
	run: blocked,
	localRuns: [blocked],
	panes: [pane()],
	exitCode: null
} satisfies ResumeSnapshot;

test('plan distinguishes ownership, exclusions, unavailable panes and opt-outs', () => {
	expect(service.plan({ ...input, item: { ...row, target: 'peer' } })?.action).toBe('other_host');
	expect(service.plan({ ...input, item: { ...row, target: 'auto' } })?.action).toBe('unassigned');
	expect(
		service.plan({
			...input,
			item: { ...row, target: 'fixture-alias' },
			hostAliases: new Map([['fixture-alias', 'fixture-peer']])
		})?.computer
	).toBe('fixture-peer');
	expect(service.plan({ ...input, item: { ...row, scheduleOff: true } })?.action).toBe('opted_out');
	for (const state of [
		{ status: 'done' },
		{ type: 'plan' },
		{ every: 'schedule' },
		{ nonWorkReason: 'non-work' }
	] as const) {
		expect(service.plan({ ...input, item: { ...row, ...state } })).toBeNull();
	}
	expect(service.plan({ ...input, panes: null })).toBeNull();
});

test('plan protects recently active settled panes and fresh peer reports after reassignment', () => {
	const recent = pane({ activity: now - 10 * minute });
	const protectedRun = service.plan({ ...input, localRuns: [blocked], panes: [recent] });
	expect(protectedRun?.action).toBe('live');
	recordWatchdogOutcome('recovery', protectedRun);
	for (const capture of [
		{ ...recent, activity: recent.activity - 1 },
		{ ...recent, live: false },
		{ ...recent, runnerSocket: false }
	])
		expect(service.plan({ ...input, localRuns: [blocked], panes: [capture] })?.action).toBe(
			'relaunch'
		);
	const peer = 'fixture-peer';
	const key = createHash('sha256').update(recent.name).digest('hex');
	const peers = [
		{
			node: peer,
			sampledAt: now - minute,
			managedPaneActivity: [[key, recent.activity]] as const
		}
	];
	const history = [{ ...blocked, node: peer }];
	expect(service.plan({ ...input, peers, history })?.action).toBe('live');
	const staleHistory = [{ ...history[0], endedAt: now - 40 * minute }];
	expect(
		service.plan({
			...input,
			peers: [{ ...peers[0], sampledAt: now - 10 * minute - 1 }],
			history: staleHistory
		})?.action
	).toBe('relaunch');
	expect(service.plan({ ...input, activeRemoteRun: true })?.action).toBe('live');
});

test('plan ignores a stopped handoff alias only when each matching pane is quiet', () => {
	const manual = pane({ name: 'auto-abc123' });
	const stopped = {
		...row,
		notes: [{ node: host, at: manual.activity + 1, text: 'stopped: handoff; resume from: branch' }]
	};
	const scan = {
		...input,
		item: stopped,
		items: [stopped],
		panes: [manual],
		localSessionNames: [manual.name]
	};
	expect(service.plan(scan)).toEqual({
		id: row.id,
		computer: host,
		action: 'relaunch',
		stoppedPanes: [manual.name]
	});
	expect(service.plan({ ...scan, panes: [manual, { ...manual, screen: null }] })?.action).toBe(
		'live'
	);
});

test('plan preserves precedence across grace, flags, queue, hold and cooldown', () => {
	expect(
		service.plan({ ...input, item: { ...row, statusAt: now - 10 * minute + 1 } })?.action
	).toBe('grace');
	expect(
		service.plan({ ...input, item: { ...row, needsDaniel: true, question: 'fixture question' } })
	).toMatchObject({ action: 'refused', reason: 'waiting on Daniel: fixture question' });
	expect(service.plan({ ...input, launcherEnabled: false, localHold: 'quota' })?.reason).toBe(
		'launcher disabled on this computer'
	);
	expect(service.plan({ ...input, localHold: 'quota', repoExists: false })?.reason).toBe('quota');
	expect(service.plan({ ...input, repoExists: false })?.reason).toBe(
		'working directory missing on this computer'
	);
	const queued = {
		...input,
		item: { ...row, autoToken: 'fixture', statusAt: now },
		lastRestartAt: now
	};
	expect(service.plan(queued)?.action).toBe('queued');
	expect(service.plan({ ...queued, scheduledHold: 'capacity' })).toMatchObject({
		action: 'refused',
		reason: 'capacity'
	});
	expect(service.plan({ ...queued, tokenStarted: true })?.action).toBe('grace');
	expect(service.plan({ ...input, lastRestartAt: now - 30 * minute + 1 })?.action).toBe('cooldown');
	expect(service.plan({ ...input, lastRestartAt: now - 30 * minute })?.action).toBe('relaunch');
});

test('resume reopens the original live run and keeps resumed timestamps monotonic', () => {
	const decision = service.resume(resume);
	expect(decision).toEqual({ runId: blocked.id, reopenItem: true, resumedAt: now });
	recordWatchdogOutcome('resume', decision);
	expect(
		service.resume({
			...resume,
			run: { ...blocked, resumedAt: now },
			item: { ...answered, status: 'in_progress' }
		})
	).toEqual({ runId: blocked.id, reopenItem: false, resumedAt: now + 1 });
});

test('resume rejects exits, replacement runs, unanswered or superseded flags, and wrong panes', () => {
	const states: Partial<ResumeSnapshot>[] = [
		{ exitCode: 0 },
		{ panes: null },
		{ panes: [pane({ runnerSocket: false })] },
		{ panes: [pane({ live: false })] },
		{ panes: [pane({ name: 'auto-abc123-r9' })] },
		{ localRuns: [blocked, run({ id: 5 })] },
		{ item: { ...answered, status: 'done' } },
		{ item: { ...answered, needsDaniel: true } },
		{ item: { ...answered, resolved: false } },
		{ item: { ...answered, clocks: { ...answered.clocks, status: clock(answerAt, 1) } } },
		{ item: { ...answered, clocks: { ...answered.clocks, question: clock(answerAt) } } },
		{
			item: {
				...answered,
				status: 'in_progress',
				blockedReason: 'new block',
				clocks: { ...answered.clocks, blockedReason: clock(now) }
			}
		},
		{ item: { ...answered, deleted: true } }
	];
	for (const state of states) expect(service.resume({ ...resume, ...state })).toBeNull();
});
