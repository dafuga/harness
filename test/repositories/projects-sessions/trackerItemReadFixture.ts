import { DatabaseSync } from 'node:sqlite';
import type { SqliteValue } from '../../../src/core/development-tooling/sqliteTypes';
import { TrackerSchemaAdapter } from '../../../src/adapters/projects-sessions/TrackerSchemaAdapter';
import {
	TrackerItemReadRepository,
	type TrackerItem
} from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';

export const NOW = Date.parse('2026-07-01T23:30:00Z');
export const CREATED = '2026-06-01T01:00:00.000Z';
export const UPDATED = '2026-06-30T02:00:00.000Z';
export const MISSED = '2026-06-29T12:00:00.000Z';
export const OCCURRENCE = '2026-06-30T12:00:00.000Z';
export const RESULT = { occurrence: OCCURRENCE, status: 'failed', note: 'fixture failed' };

const ITEMS: ReadonlyArray<Record<string, SqliteValue>> = [
	{
		id: 'abc100',
		title: 'Blocked item',
		status: 'blocked',
		due: '2026-06-30',
		blocked_reason: 'Needs a plan',
		needs_daniel: 1,
		question: 'Approve?',
		owner: 'operator',
		parent: 'fixture-parent',
		notes: 'Original note',
		auto: 'fixture-launch',
		project: 'fixture-project',
		repo: 'fixture-repo',
		computer: 'fixture-computer',
		launch_target: 'fixture-target',
		launch_source: 'fixture-source',
		launch_pick: 'fixture-pick',
		schedule_off: '1',
		schedule_status: 'fixture-schedule',
		model: 'fixture-model',
		sensitive: '1',
		adapter_instructions: 'Review the synthetic source',
		callback: JSON.stringify({
			url: 'https://fixture-user:fixture-pass@callback.example.test:8443/fixture-path?fixture=query#fixture-fragment',
			node: 'fixture-node'
		})
	},
	{
		id: 'abc100more',
		title: 'Timestamp today',
		due: '2026-07-01T23:15:00.000Z',
		owner: 'operator',
		parent: 'fixture-parent',
		callback: JSON.stringify({ cmd: 'synthetic-command-with-arguments', node: 'worker' })
	},
	{ id: 'abc200', title: 'Done item', status: 'done', due: '2026-06-28', needs_daniel: 1 },
	{
		id: 'abc300',
		title: 'Ignored item',
		status: 'ignored',
		due: '2026-06-29',
		every: '0 12 * * *',
		missed: MISSED,
		needs_daniel: 1,
		ignored_reason: 'Already reviewed',
		ignored_by: 'reviewer',
		ignored_at: UPDATED,
		ignored_until: '2026-07-01',
		ignored_prev_status: 'open'
	},
	{
		id: 'abc400',
		title: 'Resolved item',
		due: '2026-06-30',
		needs_daniel: 1,
		resolved: 1,
		created_at: '2026-06-01T00:00:00.000Z',
		blocked_reason: 'Old block reason'
	},
	{ id: 'def100', title: 'Date today', status: 'in_progress', kind: 'plan', due: '2026-07-02' },
	{
		id: 'def200',
		kind: 'recurring',
		title: 'Missed and failed',
		due: '2026-07-01',
		every: '0 12 * * *',
		every_tz: 'America/New_York',
		missed: MISSED,
		occurrence: OCCURRENCE,
		last_result: JSON.stringify(RESULT)
	},
	{
		id: 'def300',
		kind: 'recurring',
		title: 'Miss cleared',
		every: '0 12 * * *',
		missed: MISSED,
		occurrence: OCCURRENCE,
		last_result: JSON.stringify({ occurrence: OCCURRENCE, status: 'done' })
	},
	{
		id: 'def400',
		kind: 'recurring',
		title: 'Old failure',
		every: '0 12 * * *',
		created_at: '2026-06-01T02:00:00.000Z',
		occurrence: OCCURRENCE,
		last_result: JSON.stringify({ occurrence: MISSED, status: 'failed' })
	},
	{ id: 'xyz100', title: 'Later today', due: '2026-07-02T03:00:00.000Z' },
	{ id: 'xyz200', title: 'Tomorrow', due: '2026-07-03' },
	{ id: 'xyz300', title: 'Deleted', status: 'blocked', due: '2026-06-01', deleted: 1 },
	{ id: 'xyz400', title: null, status: 'blocked', due: '2026-06-01' }
];

export function insertItem(database: DatabaseSync, fields: Record<string, SqliteValue>): void {
	const row = {
		kind: 'task',
		status: 'open',
		agent: 'fixture-agent',
		created_at: CREATED,
		created_by: 'fixture-author',
		updated_at: UPDATED,
		...fields
	};
	const columns = Object.keys(row);
	database
		.prepare(
			`INSERT INTO items (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`
		)
		.run(...Object.values(row));
}

export function seedTrackerReads(database: DatabaseSync): void {
	for (const row of ITEMS) insertItem(database, row);
	const note = database.prepare(
		'INSERT INTO item_notes (item_id, hlc, node, text) VALUES (?, ?, ?, ?)'
	);
	note.run('abc100', '000000000002000-000000-beta', 'beta', 'Later note');
	note.run('abc100', '000000000001000-000001-alpha', 'alpha', 'First note');
	note.run('abc100', 'legacy-invalid', null, 'Older format');
	note.run('abc100more', '000000000003000-000000-alpha', 'alpha', 'Other item note');
}

export function trackerReadFixture() {
	const database = new DatabaseSync(':memory:');
	new TrackerSchemaAdapter(database, { now: () => NOW }).initialize();
	seedTrackerReads(database);
	return { database, repository: new TrackerItemReadRepository(database) };
}

export function publicItem(
	id: string,
	title: string,
	fields: Partial<TrackerItem> = {}
): TrackerItem {
	return {
		id,
		kind: 'task',
		title,
		status: 'open',
		stage: 'idea',
		planning: { artifacts: {}, promotions: [] },
		blocked_reason: null,
		due: null,
		remind_at: null,
		priority: 'normal',
		auto: null,
		project: null,
		repo: null,
		computer: null,
		launch_target: null,
		launch_source: null,
		launch_pick: null,
		schedule_off: false,
		schedule_status: null,
		model: null,
		sensitive: false,
		recurring: false,
		every: null,
		every_tz: null,
		occurrence: null,
		last_result: null,
		missed: null,
		owner: null,
		agent: 'fixture-agent',
		parent: null,
		notes: null,
		notes_log: [],
		needs_daniel: false,
		question: null,
		answer: null,
		answered_at: null,
		answered_by: null,
		resolved: false,
		callback: null,
		created_at: CREATED,
		created_by: 'fixture-author',
		updated_at: UPDATED,
		deleted: false,
		...fields
	};
}
