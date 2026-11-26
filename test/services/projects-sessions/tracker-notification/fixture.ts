import { expect } from '../../../verificationExpect';
import { createHash } from 'node:crypto';
import { measureWorkload } from '../../../support/measureWorkload';
import { TrackerNotificationService } from '../../../../src/services/projects-sessions/TrackerNotificationService';
import type {
	TrackerDeliveryRequest,
	TrackerNotificationItem,
	TrackerNotificationOp,
	TrackerNotificationOptions,
	TrackerNotificationSource,
	TrackerNotificationState
} from '../../../../src/services/projects-sessions/TrackerNotificationService.types';
import type { FixtureOptions, FixtureQueue } from './fixture.types';

export const start = Date.parse('2026-02-02T20:00:00Z');
export const minute = 60_000;
export const chief = { id: 'fixture-chief', kind: 'http' } as const;
export const worker = { id: 'fixture-worker', kind: 'http' } as const;
export const owner = { id: 'fixture-owner', kind: 'command' } as const;

export function emptyQueue(): TrackerNotificationState {
	return {
		callbacks: new Map(),
		reminders: new Map(),
		flags: new Map(),
		outbox: new Map(),
		attention: new Map(),
		attentionItems: new Map(),
		cursor: null
	};
}

export function memoryQueue(): FixtureQueue {
	let saved = emptyQueue();
	let tail: Promise<unknown> = Promise.resolve();
	return {
		read: () => globalThis.structuredClone(saved),
		update(change) {
			const draft = globalThis.structuredClone(saved);
			const result = change(draft);
			saved = draft;
			return result;
		},
		exclusive(work) {
			const running = tail.then(work);
			tail = running.catch(() => {});
			return running;
		}
	};
}

export function fixtureItem(
	id: string,
	fields: Partial<TrackerNotificationItem> = {}
): TrackerNotificationItem {
	return {
		id,
		title: `Fixture ${id}`,
		kind: 'task',
		status: 'open',
		needs_daniel: 0,
		resolved: 0,
		deleted: 0,
		owner: null,
		agent: null,
		due: null,
		question: null,
		answer: null,
		blocked_reason: null,
		clocks: {},
		...fields
	};
}

export function notificationFixture(input: FixtureOptions = {}) {
	let now = start;
	const rows = new Map<string, TrackerNotificationItem>();
	const ops: TrackerNotificationOp[] = [];
	const calls: TrackerDeliveryRequest[] = [];
	const queue = input.queue ?? memoryQueue();
	const source: TrackerNotificationSource = {
		node: 'fixture-node',
		tz: 'Europe/Lisbon',
		createdAt: start,
		items: () => [...rows.values()],
		item: (id) => rows.get(id),
		agent: (name) =>
			name === 'fixture-agent' ? { name, target: worker, createdAt: start } : undefined,
		maxSeq: () => ops.length,
		opsSince: (seq, limit) => ops.slice(seq, seq + limit),
		publicItem: (id) => (rows.has(id) ? { id, title: rows.get(id)?.title } : null),
		digest: () => ({ fixture: true }),
		latestNote: (id) => rows.get(id)?.notes ?? undefined,
		launchStarted: () => false
	};
	const options: TrackerNotificationOptions = {
		role: 'hub',
		source,
		queue,
		now: () => now,
		webhook: {
			destination: chief,
			routes: { 'fixture-agent': { destination: worker, aliases: ['fixture-alias'] } }
		},
		destinations: {
			available: () => true,
			send: async (request) => {
				calls.push(request);
				return input.send ? input.send(request) : { status: 'sent' };
			}
		},
		...input.options
	};
	const restart = () => new TrackerNotificationService(options);
	return {
		service: restart(),
		restart,
		calls,
		rows,
		ops,
		queue,
		options,
		at: (time: number) => {
			now = time;
		}
	};
}

export function clock(at = start): string {
	return `${String(at).padStart(15, '0')}-000000-fixture-node`;
}

export function eventId(...keys: string[]): string {
	return createHash('sha256').update(keys.sort().join('\n')).digest('hex').slice(0, 32);
}

export function wire(request: TrackerDeliveryRequest) {
	return JSON.parse(request.body);
}

export function measureTick(service: TrackerNotificationService, workload: string): Promise<void> {
	return measureWorkload('service.projects-sessions-tracker-notification', workload, () =>
		service.tick()
	);
}

export async function verifyDirectFollowUps(
	f: ReturnType<typeof notificationFixture>,
	first: number
) {
	f.at(first + 119 * minute);
	await f.service.tick();
	expect(f.calls).toHaveLength(2);
	f.at(first + 120 * minute);
	await f.restart().tick();
	expect(wire(f.calls[2])).toMatchObject({
		new: [],
		reminders: [{ id: 'flag', reminder_number: 1, waiting_minutes: 125 }]
	});
	f.at(first + 360 * minute);
	await f.restart().tick();
	expect(wire(f.calls[3])).toMatchObject({
		reminders: [{ id: 'flag', reminder_number: 2, waiting_minutes: 365 }]
	});
	const nextMorning = Date.parse('2026-02-03T08:00:00Z');
	const parkedUntil = nextMorning + 10 * minute;
	f.rows.set('flag', {
		...f.rows.get('flag')!,
		status: 'done',
		parked_until: new Date(parkedUntil).toISOString()
	});
	f.at(nextMorning);
	await f.service.tick();
	expect(f.calls).toHaveLength(4);
	f.at(parkedUntil);
	await f.restart().tick();
	expect(wire(f.calls[4])).toMatchObject({
		reminders: [{ id: 'flag', reminder_number: 3, waiting_minutes: 550 }]
	});
	f.rows.set('flag', { ...f.rows.get('flag')!, resolved: 1 });
	f.at(nextMorning + 24 * 60 * minute);
	await f.service.tick();
	expect(f.calls).toHaveLength(5);
	expect([...f.queue.read().reminders.values()].every((r) => r.status === 'closed')).toBe(true);
}

export async function verifyParkedReminderRetry(
	f: ReturnType<typeof notificationFixture>,
	wake: number
) {
	const snooze = (at: number) => new Date(at).toISOString();
	f.at(wake);
	await f.restart().tick();
	expect(f.queue.read().inFlight).toBeUndefined();
	expect(f.calls).toHaveLength(1);
	const parkedUntil = wake + 10 * minute;
	f.rows.set('delayed', { ...f.rows.get('delayed')!, parked_until: snooze(parkedUntil) });
	f.at(parkedUntil - 1);
	await f.restart().tick();
	expect(f.calls).toHaveLength(1);
	f.at(parkedUntil);
	await measureTick(f.restart(), 'explicit-reminder-at-wake');
	expect(f.calls.map(({ id }) => id)).toEqual([f.calls[0].id, f.calls[0].id]);
	expect(wire(f.calls[1])).toMatchObject({
		type: 'attention',
		new: [
			{
				id: 'delayed',
				reason: 'remind_at',
				remind_at: snooze(wake),
				question: 'Approve the fixture?'
			}
		]
	});
	await f.restart().tick();
	expect(f.calls).toHaveLength(2);
}
