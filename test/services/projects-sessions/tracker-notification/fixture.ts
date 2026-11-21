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
		quietHours: { tz: source.tz, start: '22:00', end: '08:00' },
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
