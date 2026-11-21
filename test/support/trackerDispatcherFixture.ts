import { DatabaseSync } from 'node:sqlite';
import { onTestFinished } from 'vitest';
import { expect } from '../verificationExpect';
import { TrackerDispatcherService } from '../../src/services/agents-providers/TrackerDispatcherService';
import type {
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchResult,
	TrackerDispatchSnapshot,
	TrackerDispatchStore,
	TrackerDispatchWrites,
	TrackerRunReceipt
} from '../../src/services/agents-providers/TrackerDispatcherService.types';
import type {
	DispatcherFixtureConditions,
	DispatcherFixtureOptions
} from './trackerDispatcherFixture.types';

export const primary = 'daniel-primary-mbp';
export const secondary = 'harbor-mbp-2';
export const sampleId = 'fixture-item';
export const sampleToken = 'fixture-token';
const firstPick = {
	id: 'haiku',
	cli: 'claude',
	model: 'claude-haiku-5-5',
	effort: 'high'
} as const;
const retryPick = { id: 'sol', cli: 'codex', model: 'gpt-6.2-sol', effort: 'xhigh' } as const;
function readJson<T>(row: Record<string, unknown>): T {
	return JSON.parse(String(row.data)) as T;
}

class DispatcherLedger implements TrackerDispatchStore {
	private readonly db = new DatabaseSync(':memory:');
	readonly failure = { commit: false };

	constructor(
		private readonly node: string,
		private readonly conditions: DispatcherFixtureConditions
	) {
		onTestFinished(() => this.db.close());
		this.db.exec(`CREATE TABLE items(id TEXT PRIMARY KEY, data TEXT);
			CREATE TABLE runs(node TEXT, id INTEGER, item TEXT, token TEXT, attempt INTEGER, data TEXT,
				PRIMARY KEY(node, id), UNIQUE(item, token, attempt));
			CREATE TABLE due_start(at INTEGER);
			INSERT INTO due_start VALUES (NULL);`);
	}

	item = (id = sampleId) => {
		const row = this.db.prepare('SELECT data FROM items WHERE id = ?').get(id);
		return row ? readJson<TrackerDispatchItem>(row) : null;
	};

	runs = (id = sampleId) =>
		this.db
			.prepare('SELECT data FROM runs WHERE item = ? ORDER BY id')
			.all(id)
			.map(readJson<TrackerRunReceipt>);

	changeItem = (patch: Partial<TrackerDispatchItem>) => {
		const id = patch.id ?? sampleId;
		this.db
			.prepare('INSERT OR REPLACE INTO items VALUES (?, ?)')
			.run(id, JSON.stringify({ ...this.item(), ...this.item(id), ...patch, id }));
	};

	writeRun = (run: TrackerRunReceipt) =>
		this.db
			.prepare(
				`INSERT INTO runs VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(node, id) DO UPDATE SET data = excluded.data`
			)
			.run(run.node, run.id, run.item_id, run.auto_token, run.attempt, JSON.stringify(run));

	removeItem = () => this.db.prepare('DELETE FROM items WHERE id = ?').run(sampleId);

	private snapshot(id: string): TrackerDispatchSnapshot {
		const runId = this.db
			.prepare('SELECT coalesce(max(id), 0) + 1 AS id FROM runs WHERE node = ?')
			.get(this.node);
		const dueStart = this.db.prepare('SELECT at FROM due_start').get()?.at;
		return {
			item: this.item(id),
			runs: this.runs(id),
			nextRunId: Number(runId?.id),
			...this.conditions,
			lastDueStartAt: typeof dueStart === 'number' ? dueStart : undefined
		};
	}

	private apply(id: string, writes?: TrackerDispatchWrites) {
		if (!writes) return;
		if (writes.item) this.changeItem({ ...writes.item, id });
		for (const run of writes.runs ?? []) this.writeRun(run);
		if (writes.lastDueStartAt !== undefined)
			this.db.prepare('UPDATE due_start SET at = ?').run(writes.lastDueStartAt);
	}

	update: TrackerDispatchStore['update'] = (id, decide) =>
		Promise.resolve().then(() => {
			this.db.exec('BEGIN IMMEDIATE');
			try {
				const { result, writes } = decide(this.snapshot(id));
				this.apply(id, writes);
				if (this.failure.commit) throw new Error('injected commit failure');
				this.db.exec('COMMIT');
				return result;
			} catch (error) {
				this.db.exec('ROLLBACK');
				throw error;
			}
		});
}

export function dispatcherFixture(options: DispatcherFixtureOptions = {}) {
	let at = Date.parse('2026-11-21T01:00:00Z');
	const policy = fixturePolicy(() => at, options.policy);
	const conditions: DispatcherFixtureConditions = { openSession: false, due: options.due };
	const store = new DispatcherLedger(policy.node, conditions);
	store.changeItem({
		title: 'Update synthetic fixture',
		project: 'harness',
		kind: 'task',
		status: 'open',
		createdBy: primary,
		due: '2026-11-20',
		...options.item
	});
	return {
		service: new TrackerDispatcherService(store, policy),
		store,
		policy,
		conditions,
		failure: store.failure,
		item: store.item,
		runs: store.runs,
		writeRun: store.writeRun,
		changeItem: store.changeItem,
		removeItem: store.removeItem,
		advance: (elapsed: number) => {
			at += elapsed;
		}
	};
}

function fixturePolicy(
	now: () => number,
	overrides?: Partial<TrackerDispatchPolicy>
): TrackerDispatchPolicy {
	return {
		node: primary,
		timezone: 'America/Vancouver',
		now,
		chooseHost: (_item, scope) => ({ node: scope.requestedNode ?? primary, why: 'fixture host' }),
		admit: () => null,
		pickModel: () => ({ rung: firstPick, kind: 'coding', reason: 'fixture ladder' }),
		retryModel: (_item, run) =>
			run.pinned && run.cli !== 'none'
				? { ...firstPick, id: run.rung, cli: run.cli, model: run.model, effort: run.effort }
				: retryPick,
		...overrides
	};
}

export function started(result: TrackerDispatchResult) {
	expect(result.status).toBe('start');
	if (result.status !== 'start') throw new Error('expected reservation');
	return result;
}

export function recorded(result: TrackerDispatchResult) {
	expect(result.status).toBe('recorded');
	if (result.status !== 'recorded') throw new Error('expected recorded result');
	return result;
}

export async function reserveFixture(fixture: ReturnType<typeof dispatcherFixture>) {
	await fixture.service.request(sampleId, { source: 'manual', token: sampleToken });
	return started(await fixture.service.claim(sampleId, sampleToken));
}

export function liveEvidence(start: ReturnType<typeof started>) {
	return {
		key: start.key,
		id: 'synthetic-session',
		state: 'live' as const,
		startedAt: start.run.queued_at
	};
}

export async function runFixture(fixture: ReturnType<typeof dispatcherFixture>) {
	const reservation = await reserveFixture(fixture);
	const session = liveEvidence(reservation);
	const { run } = recorded(
		await fixture.service.record(sampleId, reservation.run, { type: 'session', session })
	);
	return { run, session };
}
