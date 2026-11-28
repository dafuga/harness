import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { TrackerAdapterSourceRepository } from '../src/repositories/projects-sessions/TrackerAdapterSourceRepository';
import {
	compatibilityFixture,
	fixtureItem,
	fixtureTitle
} from './support/trackerCliCompatibilityFixture';
import { adapterIssue } from './support/trackerAdapterFixture';
import { primary } from './support/trackerDispatcherFixture';

function seedOptedOutItem({
	store
}: Awaited<ReturnType<typeof compatibilityFixture>>['runtime']): void {
	store.appendLocal({
		itemId: 'skipped',
		fields: {
			title: 'Skipped fixture',
			kind: 'task',
			status: 'open',
			due: '2026-11-20',
			schedule_off: 1
		}
	});
}

test('native autolaunch status and dry-run inspect the configured policy without dispatching', async () => {
	const { runtime, runner, run } = await compatibilityFixture();
	seedOptedOutItem(runtime);
	const seq = runtime.store.maxSeq();
	const preview = await run('autolaunch', 'dry-run');
	expect(preview).toMatchObject({ code: 0, err: '' });
	const data = JSON.parse(preview.out);
	expect(data).toEqual({
		enabled: true,
		adapter_due_enabled: false,
		paused: false,
		source: primary,
		launches: [
			{
				id: fixtureItem,
				title: fixtureTitle,
				due: '2026-11-21',
				computer: primary,
				project: 'harness',
				model: 'claude-haiku-5-5',
				effort: 'high',
				reason: 'fixture host'
			}
		],
		skipped: [
			{
				id: 'skipped',
				title: 'Skipped fixture',
				due: '2026-11-20',
				reason: 'Legacy automatic launch pause until 2026-11-22T12:00:00.000Z'
			}
		]
	});
	const status = await run('autolaunch', '--json');
	expect(JSON.parse(status.out)).toMatchObject({ enabled: true, scheduler: data, active: [] });
	runtime.store.writeMeta({ due_scheduler_paused: '1' });
	const paused = JSON.parse((await run('autolaunch', 'dry-run', '--json')).out);
	expect(paused).toMatchObject({
		paused: true,
		launches: [],
		skipped: expect.arrayContaining([
			expect.objectContaining({ id: fixtureItem, reason: 'due scheduling is paused' })
		])
	});
	expect(runtime.store.maxSeq()).toBe(seq);
	expect(runner.start).not.toHaveBeenCalled();
	expect(runner.observe).not.toHaveBeenCalled();
});

test('native adapter list reads legacy rows only for the persisted runner', async () => {
	const { database, run } = await compatibilityFixture();
	expect(await run('adapter', 'list')).toMatchObject({
		code: 1,
		err: 'tracker: configure and run adapters on the designated Tracker runner'
	});
	new TrackerAdapterSourceRepository(database).initialize();
	database.prepare('INSERT INTO adapter_runner VALUES (1, ?)').run(primary);
	const id = 'github:fixture/repo';
	const config = { id, type: 'github', target: 'fixture/repo', agent: 'harness' };
	database
		.prepare('INSERT INTO adapter_sources VALUES (?, ?, 100, 200, 1, 0, 300, ?)')
		.run(id, JSON.stringify(config), 'fixture backoff');
	database
		.prepare("INSERT INTO adapter_sources VALUES ('removed', '{}', 0, 0, 0, 1, NULL, NULL)")
		.run();
	expect(await run('adapter', 'list')).toEqual({
		code: 0,
		err: '',
		out: `${id} → harness (paused) on ${primary} [fixture backoff]`
	});
	const json = await run('adapter', 'list', '--json');
	expect(JSON.parse(json.out)).toEqual([
		{
			...config,
			enabled_at: 100,
			cursor: 200,
			runner: primary,
			paused: true,
			last_run: 300,
			last_error: 'fixture backoff'
		}
	]);
});

function commentCompatibilityFixture() {
	return compatibilityFixture(false, {
		manual: true,
		lease: { owner: primary, tryAcquire: () => () => {} },
		redactText: (text) => text,
		intakePolicy: () => ({
			followUp: { author: 'fixture-tester', instructions: 'Retest #{issue}.' }
		}),
		provider: {
			async *readIssues() {},
			async readIssue() {
				return adapterIssue();
			},
			async readTimeline() {
				return [];
			},
			async *readComments() {
				yield {
					id: 151,
					body: 'Please restore retry',
					issue_url: 'https://api.github.com/repos/fixture/repo/issues/17',
					// Inside the seven-day backfill window on whatever day the test runs.
					created_at: new Date(Date.now() - 86_400_000).toISOString(),
					user: { type: 'User', login: 'fixture-tester' }
				};
			}
		}
	});
}

test('native adapter run previews seven-day corrections through the compatibility API', async () => {
	const { database, run, runtime } = await commentCompatibilityFixture();
	const sources = new TrackerAdapterSourceRepository(database);
	sources.initialize();
	const id = 'github:fixture/repo';
	const config = {
		id,
		type: 'github',
		target: 'fixture/repo',
		kind: 'task',
		agent: 'harness',
		auto_launch: 'unlabeled'
	};
	database
		.prepare('INSERT INTO adapter_sources VALUES (?, ?, 100, 200, 0, 0, NULL, NULL)')
		.run(id, JSON.stringify(config));
	const seq = runtime.store.maxSeq();
	await runtime.adapter?.tick(new AbortController().signal);
	expect(sources.source(id)?.cursor).toBe(200);
	const preview = await run('adapter', 'run', id, '--backfill-comments', '--dry-run');
	expect(preview).toMatchObject({
		code: 0,
		err: '',
		out: expect.stringContaining('would create fixture/repo #17')
	});
	expect(preview.out).toContain('/17#issuecomment-151');
	expect(runtime.store.maxSeq()).toBe(seq);
	const result = await run('adapter', 'run', id, '--backfill-comments', '--json');
	expect(result.code).toBe(0);
	expect(JSON.parse(result.out)).toMatchObject({
		dry_run: false,
		actions: [{ external_id: 'comment:151', auto_launch: true }]
	});
	expect(sources.source(id)?.cursor).toBe(200);
	expect(await run('adapter', 'run', id, '--backfill-comments')).toMatchObject({
		code: 0,
		out: 'No items to create or link.'
	});
});

test('native backup list shows local files; a node without backups refuses to take one', async () => {
	const { directory, route, run } = await compatibilityFixture(false);
	writeFileSync(join(directory, 'tracker-2026-11-20.db.gz'), 'fixture');
	writeFileSync(join(directory, 'unrelated'), 'ignored');
	const result = await run('backup', 'list', '--json');
	expect(result).toMatchObject({ code: 0, err: '' });
	expect(JSON.parse(result.out)).toMatchObject({
		status: { enabled: false },
		files: [
			{
				name: 'tracker-2026-11-20.db.gz',
				kind: 'daily',
				date: '2026-11-20',
				size: 7,
				mtime: expect.any(String)
			}
		]
	});
	expect(await run('backup', 'list')).toMatchObject({
		code: 0,
		out: expect.stringContaining('tracker-2026-11-20.db.gz')
	});
	expect(await run('backup', 'now')).toMatchObject({
		code: 1,
		err: 'tracker: native backups are not enabled on this node'
	});
	expect(await run('backup', 'prune')).toMatchObject({
		code: 1,
		err: 'tracker: usage: tracker backup list'
	});
	expect(route).toHaveBeenCalledTimes(3);
});
