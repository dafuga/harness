import { afterEach, beforeEach, expect, test } from 'vitest';
import { readTrackerSources } from '../../../packages/reports/src/lib/projects-sessions/project-overview/projectOverviewTracker';
import { insertItem, publicItem, trackerReadFixture, UPDATED } from './trackerItemReadFixture';

let fixture: ReturnType<typeof trackerReadFixture>;

beforeEach(() => {
	fixture = trackerReadFixture();
});

afterEach(() => fixture.database.close());

const notes = [
	{ at: '1970-01-01T00:00:01.000Z', node: 'alpha', text: 'First note' },
	{ at: '1970-01-01T00:00:02.000Z', node: 'beta', text: 'Later note' },
	{ at: '1970-01-01T00:00:00.000Z', node: null, text: 'Older format' }
];

test('get selects the exact normalized ID and returns full public fields and ordered notes', () => {
	const item = fixture.repository.get('  ABC100 ');
	expect(item).toEqual(
		publicItem('abc100', 'Blocked item', {
			status: 'blocked',
			blocked_reason: 'Needs a plan',
			needs_daniel: true,
			question: 'Approve?',
			due: '2026-06-30',
			owner: 'operator',
			parent: 'fixture-parent',
			notes: 'Original note',
			notes_log: notes,
			auto: 'fixture-launch',
			project: 'fixture-project',
			repo: 'fixture-repo',
			computer: 'fixture-computer',
			launch_target: 'fixture-target',
			launch_source: 'fixture-source',
			launch_pick: 'fixture-pick',
			schedule_off: false,
			schedule_status: 'fixture-schedule',
			model: 'fixture-model',
			sensitive: true,
			adapter_instructions: 'Review the synthetic source',
			callback: { target: 'webhook callback.example.test:8443', node: 'fixture-node' }
		})
	);
	expect(fixture.repository.get(' ABC100M ')).toEqual(
		publicItem('abc100more', 'Timestamp today', {
			due: '2026-07-01T23:15:00.000Z',
			owner: 'operator',
			parent: 'fixture-parent',
			callback: { target: 'command', node: 'worker' },
			notes_log: [{ at: '1970-01-01T00:00:03.000Z', node: 'alpha', text: 'Other item note' }]
		})
	);
});

test('get reports required, ambiguous, missing and deleted IDs with legacy statuses', () => {
	const { repository } = fixture;
	const cases = [
		['  ', 400, 'item id required'],
		['AbC1', 400, '"abc1" is ambiguous; use more characters'],
		[' missing ', 404, 'no item "missing"'],
		['xyz300', 404, 'no item "xyz300"']
	] as const;
	for (const [id, status, message] of cases) {
		expect(() => repository.get(id)).toThrow(expect.objectContaining({ status, message }));
	}
	insertItem(fixture.database, { id: 'xyz300more', title: 'Live child of deleted prefix' });
	expect(repository.get('xyz300').id).toBe('xyz300more');
});

test('get redacts invalid URL and malformed callback metadata', () => {
	insertItem(fixture.database, {
		id: 'legacy-callback',
		title: 'Legacy callback',
		callback: JSON.stringify({ url: 'invalid-fixture-target', node: 'legacy-node' })
	});
	expect(fixture.repository.get('legacy-callback').callback).toEqual({
		target: 'webhook',
		node: 'legacy-node'
	});
	insertItem(fixture.database, {
		id: 'malformed-callback',
		title: 'Malformed callback',
		callback: 'invalid-synthetic-callback-content'
	});
	expect(() => fixture.repository.get('malformed-callback')).toThrow(
		/^Invalid Tracker callback metadata$/
	);
});

test('list defaults to active titled rows ordered by due, creation, then null due', () => {
	const { repository } = fixture;
	expect(repository.list().map(({ id }) => id)).toEqual([
		'abc400',
		'abc100',
		'def200',
		'abc100more',
		'def100',
		'xyz100',
		'xyz200',
		'def300',
		'def400'
	]);
	expect(repository.list({ limit: '2' }).map(({ id }) => id)).toEqual(['abc400', 'abc100']);
});

test('list combines exact filters and normalizes status and loopback query flags', () => {
	const { repository } = fixture;
	for (const status of ['In Progress', 'in-progress', 'INPROGRESS']) {
		expect(repository.list({ status, kind: 'plan' }).map(({ id }) => id)).toEqual(['def100']);
	}
	expect(
		repository
			.list({
				owner: 'operator',
				agent: 'fixture-agent',
				kind: 'task',
				parent: 'fixture-parent',
				flagged: '1'
			})
			.map(({ id }) => id)
	).toEqual(['abc100']);
	expect(repository.list({ recurring: 'true' }).map(({ id }) => id)).toEqual([
		'def200',
		'def300',
		'def400'
	]);
	expect(repository.list({ flagged: 'false', recurring: '0' })).toEqual(repository.list());
	expect(repository.list({ parent: "fixture-parent'" })).toEqual([]);
	expect(() => repository.list({ status: 'ALL' })).toThrow(
		expect.objectContaining({
			status: 400,
			message: 'status must be open, in_progress, blocked, done or ignored'
		})
	);
});

test('list returns ignored metadata for explicit reads even after the ignore expiry', () => {
	expect(fixture.repository.list({ status: 'ignored', flagged: true, recurring: true })).toEqual([
		publicItem('abc300', 'Ignored item', {
			status: 'ignored',
			due: '2026-06-29',
			needs_daniel: true,
			recurring: true,
			every: '0 12 * * *',
			every_tz: 'Europe/Lisbon',
			missed: '2026-06-29T12:00:00.000Z',
			ignored_reason: 'Already reviewed',
			ignored_by: 'reviewer',
			ignored_at: UPDATED,
			ignored_until: '2026-07-01'
		})
	]);
});

test('list caps the default and accepts loopback unlimited reads', () => {
	const database = fixture.database;
	const insert = database.prepare('INSERT INTO items(id,title,status) VALUES (?,?,?)');
	for (let i = 0; i < 501; i++) insert.run(`bulk-${i}`, 'Bulk row', 'open');
	expect(fixture.repository.list()).toHaveLength(500);
	expect(fixture.repository.list({ limit: '0' })).toHaveLength(500);
	expect(fixture.repository.list({ limit: 'bad' })).toHaveLength(500);
	expect(fixture.repository.list({ limit: '-1', status: 'all' })).toHaveLength(512);
});

test('list JSON is accepted by the Project Overview loopback reader', async () => {
	const urls: string[] = [];
	const fetcher = async (input: Parameters<typeof fetch>[0]) => {
		const url = new URL(String(input));
		urls.push(url.href);
		return Response.json(
			url.pathname === '/items' ? fixture.repository.list(Object.fromEntries(url.searchParams)) : []
		);
	};
	const data = await readTrackerSources(fetcher as typeof fetch);
	expect(urls).toContain('http://127.0.0.1:7701/items?status=all&limit=-1');
	expect(data.items).toHaveLength(11);
	expect(data.items.map(({ status }) => status)).toContain('ignored');
	expect(data.items.map(({ status }) => status)).toContain('done');
	expect(data.items.find(({ id }) => id === 'abc100')).toEqual({
		id: 'abc100',
		title: 'Blocked item',
		status: 'blocked',
		updated_at: UPDATED,
		due: '2026-06-30',
		agent: 'fixture-agent',
		sensitive: true,
		deleted: false,
		blocked_reason: 'Needs a plan',
		needs_daniel: true,
		resolved: false,
		question: 'Approve?',
		notes_log: notes.map(({ at, text }) => ({ at, text }))
	});
});
