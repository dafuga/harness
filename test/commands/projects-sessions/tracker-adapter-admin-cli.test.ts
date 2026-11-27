import { afterEach, expect, test, vi } from 'vitest';
import { compatibilityFixture } from '../../support/trackerCliCompatibilityFixture';
import { adapterIssue } from '../../support/trackerAdapterFixture';
import { primary } from '../../support/trackerDispatcherFixture';
import type { TrackerAdapterReadQuery } from '../../../src/services/projects-sessions/TrackerAdapterPollService.types';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

const id = 'github:fixture/repo';

async function adminFixture(owner: string = primary) {
	const lease = { owner, tryAcquire: vi.fn((): (() => void) | null => () => {}) };
	const readIssues = vi.fn(async function* (_source: unknown, _query: TrackerAdapterReadQuery) {
		yield adapterIssue({ created_at: '2026-11-01T00:00:00Z' });
	});
	const fixture = await compatibilityFixture(false, {
		manual: true,
		lease,
		redactText: (text) => text,
		provider: {
			readIssues,
			async readTimeline() {
				return [];
			}
		}
	});
	return { ...fixture, lease, readIssues };
}

test('adapter add, pause, resume and remove manage a source on its runner', async () => {
	const { run, lease } = await adminFixture();
	const add = ['adapter', 'add', 'github', '--repo', 'Fixture/Repo', '--agent', 'harness'];
	const added = await run(...add, '--include-labels', 'Bug, bug,ui', '--auto-launch', 'unlabeled');
	expect(added).toMatchObject({
		code: 0,
		err: '',
		out: `Enabled ${id} at 2026-11-21T12:00:00.000Z`
	});
	const listed = async () => JSON.parse((await run('adapter', 'list', '--json')).out);
	expect(await listed()).toMatchObject([
		{
			id,
			type: 'github',
			target: 'fixture/repo',
			kind: 'task',
			agent: 'harness',
			project: 'harness',
			computer: 'auto',
			owner: null,
			model: null,
			auto_launch: 'unlabeled',
			include_labels: ['bug', 'ui'],
			exclude_labels: [],
			paused: false
		}
	]);
	expect(await run(...add)).toMatchObject({ code: 1, err: 'tracker: adapter already exists' });
	expect((await run('adapter', 'pause', id)).out).toBe(`${id} is paused`);
	expect(await listed()).toMatchObject([{ paused: true }]);
	expect((await run('adapter', 'resume', id)).out).toBe(`${id} is enabled`);
	lease.tryAcquire.mockReturnValueOnce(null);
	expect(await run('adapter', 'remove', id)).toMatchObject({
		code: 1,
		err: expect.stringContaining('poll is running')
	});
	expect((await run('adapter', 'remove', id)).out).toBe(`Removed ${id}`);
	expect(await listed()).toEqual([]);
	expect(await run('adapter', 'pause', id)).toMatchObject({
		code: 1,
		err: 'tracker: adapter not found'
	});
	expect((await run(...add)).code).toBe(0);
	expect(await listed()).toMatchObject([{ paused: false, auto_launch: 'never' }]);
});

test('adapter add rejects bad input without saving a source', async () => {
	const { run, database } = await adminFixture();
	const base = ['adapter', 'add', 'github', '--repo', 'fixture/repo'];
	const cases: [string[], string][] = [
		[base, 'requires an agent'],
		[['adapter', 'add', 'gitlab', '--repo', 'a/b', '--agent', 'x'], 'unknown adapter type'],
		[['adapter', 'add', 'github', '--repo', 'nope', '--agent', 'x'], 'OWNER/REPO'],
		[[...base, '--agent', 'x', '--auto-launch', 'always'], 'never or unlabeled'],
		[[...base, '--agent', 'x', '--kind', 'plan', '--auto-launch', 'unlabeled'], 'only tasks'],
		[[...base, '--agent', 'x', '--kind', 'reminder'], 'kind must be'],
		[[...base, '--agent', 'x', '--every', '0 9 * * *'], 'require --kind recurring'],
		[[...base, '--agent', 'x', '--kind', 'recurring', '--every', 'bad'], 'schedule'],
		[[...base, '--agent', 'x', '--computer', 'no spaces'], 'computer'],
		[[...base, '--agent', 'x', '--after', '2026-11-01'], '--after'],
		[[...base, '--agent', 'x', '--backfill'], '--backfill']
	];
	for (const [args, message] of cases)
		expect(await run(...args)).toMatchObject({ code: 1, err: expect.stringContaining(message) });
	expect(
		database.prepare("SELECT 1 FROM sqlite_master WHERE name = 'adapter_runner'").get()
	).toBeUndefined();
});

test('adapter changes are refused away from the designated runner', async () => {
	const { run } = await adminFixture('fixture-other-node');
	expect(
		await run('adapter', 'add', 'github', '--repo', 'fixture/repo', '--agent', 'harness')
	).toMatchObject({ code: 1, err: 'tracker: Run adapters on the designated Tracker runner' });
});

test('adapter add --dry-run and run --backfill preview older open issues', async () => {
	const { run, database, runtime, readIssues } = await adminFixture();
	const add = ['adapter', 'add', 'github', '--repo', 'fixture/repo', '--agent', 'harness'];
	const seq = runtime.store.maxSeq();
	const preview = await run(...add, '--dry-run', '--backfill', '--after', '2026-11-10T00:00:00Z');
	expect(preview).toMatchObject({ code: 0, err: '' });
	expect(preview.out).toContain('would create fixture/repo #17: Fixture issue');
	expect(readIssues.mock.lastCall?.[1]).toMatchObject({
		backfill: true,
		since: Date.parse('2026-11-10T00:00:00Z') - 5_000
	});
	expect(runtime.store.maxSeq()).toBe(seq);
	expect(
		database.prepare("SELECT 1 FROM sqlite_master WHERE name = 'adapter_sources'").get()
	).toBeUndefined();
	await run(...add);
	expect((await run('adapter', 'run', id, '--dry-run')).out).toBe('No items to create or link.');
	const older = await run('adapter', 'run', id, '--backfill', '--dry-run');
	expect(older.out).toContain('would create fixture/repo #17: Fixture issue');
	expect(readIssues.mock.lastCall?.[1]).toMatchObject({ backfill: true });
	expect(await run('adapter', 'run', id, '--backfill', '--backfill-comments')).toMatchObject({
		code: 1,
		err: expect.stringContaining('one backfill')
	});
	expect((await run('adapter', 'run', id, '--backfill')).code).toBe(0);
	expect(runtime.store.maxSeq()).toBeGreaterThan(seq);
});
