import { readdirSync } from 'node:fs';
import { test, vi } from 'vitest';
import { trackerBoxJobFixture } from '../../support/trackerBoxJobFixture';
import { expect } from '../../verificationExpect';

const patient = { timeout: 8_000, interval: 50 };
const slowCase = { timeout: 30_000 };

test(
	'runs a migrated box job on the hub and wakes the owner with its redacted finding',
	slowCase,
	async () => {
		vi.stubEnv('HARNESS_TRACKER_PHONE_WRITE_TOKEN', 'fixture-service-only');
		const hub = await trackerBoxJobFixture();
		const node = hub.start();
		const id = await node.recurringItem('Migrated issue scan');
		// A migrated hub already holds the row; the legacy schema is the whole contract.
		hub.database
			.prepare('INSERT INTO box_jobs (item_id, cmd, created_at, updated_at) VALUES (?, ?, 1, 1)')
			.run(
				id,
				'echo "item=$TRACKER_ITEM_ID at=$TRACKER_OCCURRENCE cwd=$(basename "$PWD") state=$(basename "$TRACKER_STATE_DIR") service=${HARNESS_TRACKER_PHONE_WRITE_TOKEN:-absent}"; echo "token=abc123"; echo "2 new issues"; exit 10'
			);
		await node.tick();
		hub.advanceHour();
		await expect
			.poll(async () => (await node.tick(), (await node.history(id))[0]), patient)
			.toMatchObject({ status: 'done', by: 'box-job', note: 'box job: finding: 2 new issues' });
		expect(node.wakes).toHaveBeenCalledTimes(1);
		expect(node.wakes.mock.calls[0][0]).toMatchObject({
			kind: 'recurring_due',
			itemId: id,
			payload: {
				box_job: { exit_code: 10, timed_out: false, status: 'finding' },
				finding: [
					`item=${id} at=2026-11-21T11:00:00.000Z cwd=${id} state=${id} service=absent`,
					'token=[redacted]',
					'2 new issues'
				].join('\n')
			}
		});
		expect(node.runtime.recurring!.status()).toEqual({
			enabled: true,
			jobs: 1,
			running: [],
			queued: 0
		});
	}
);

test(
	'runs two jobs at once, then records a timeout and each interruption without a rerun',
	slowCase,
	async () => {
		const hub = await trackerBoxJobFixture();
		const first = hub.start();
		const ids: string[] = [];
		for (const title of ['Alpha disk probe', 'Beta issue scan', 'Gamma mail sweep'])
			ids.push(await first.recurringItem(title));
		// Jobs are claimed in item id order: the first two start and the third waits.
		ids.sort();
		for (const [index, id] of ids.entries()) {
			const cmd = 'echo run >> "$TRACKER_STATE_DIR/runs"; sleep 30';
			const timeout_s = index === 0 ? 1 : 60;
			await first.request('POST', `/jobs/${id}`, { cmd, timeout_s, wake_on: 'fail' });
		}
		await first.tick();
		hub.advanceHour();
		await first.tick();
		const status = () => first.runtime.recurring!.status();
		expect(status()).toMatchObject({ jobs: 3, queued: 1 });
		expect(status().running).toHaveLength(2);
		const hung = ids[0];
		await expect
			.poll(async () => (await first.tick(), (await first.history(hung))[0].note), patient)
			.toBe('box job: timed out after 1s');
		await expect.poll(async () => (await first.tick(), status().queued), patient).toBe(0);
		await first.shutdown();
		const second = hub.start();
		await second.tick();
		for (const id of ids.slice(1)) {
			expect((await second.history(id))[0]).toMatchObject({
				status: 'failed',
				note: 'box job: exit 1: interrupted: Tracker shut down while the job was running'
			});
		}
		expect(second.runtime.recurring!.status()).toMatchObject({ running: [], queued: 0 });
		const slow = ids[1];
		hub.advanceHour();
		await second.tick();
		// A replacement process cannot see the earlier one's child, as after a crash.
		const third = hub.start();
		await third.tick();
		expect((await third.history(slow))[0]).toMatchObject({
			status: 'failed',
			note: 'box job: exit 1: interrupted: Tracker stopped before the job reported a result'
		});
		await second.shutdown();
		expect(readdirSync(`${hub.root}/jobs/state`).sort()).toEqual([...ids].sort());
	}
);

test('sets, lists, tests and removes a job over the hub API', slowCase, async () => {
	const hub = await trackerBoxJobFixture();
	const node = hub.start();
	const id = await node.recurringItem('Disk check');
	const plain = (await node.request('POST', '/items', { title: 'Plain paperwork' })).body.id;
	const route = `/jobs/${id.slice(0, 6)}`;
	const rejected = [
		[`/jobs/${plain}`, { cmd: 'true' }, 'a box job needs a recurring item'],
		[route, {}, 'a box job needs --cmd'],
		[route, { cmd: 'true', wake_on: 'sometimes' }, 'wake-on must be finding, fail or always'],
		[route, { cmd: 'true', timeout_s: 3601 }, 'timeout must be 1-3600 seconds']
	] as const;
	for (const [path, body, message] of rejected) {
		const response = await node.request('POST', path, body);
		expect(response.status).toBe(400);
		expect(response.body.error).toContain(message);
	}
	const cmd = 'echo "secret=hunter2"; echo "62 GB free"';
	expect(await node.request('POST', route, { cmd, timeout_s: 30 })).toMatchObject({
		status: 200,
		body: { item_id: id, cmd, wake_on: 'finding', timeout_s: 30 }
	});
	expect((await node.request('POST', route, { wake_on: 'always' })).body).toMatchObject({
		cmd,
		wake_on: 'always',
		timeout_s: 30
	});
	expect((await node.request('GET', '/jobs')).body).toMatchObject([
		{ item_id: id, title: 'Disk check', every: '@hourly', wake_on: 'always', running: false }
	]);
	expect((await node.request('POST', route + '/test')).body).toEqual({
		item_id: id,
		exit_code: 0,
		timed_out: false,
		finding: false,
		output: 'secret=[redacted]\n62 GB free\n'
	});
	expect(await node.history(id)).toEqual([]);
	expect(node.wakes).not.toHaveBeenCalled();
	expect((await node.request('DELETE', route)).body).toEqual({ removed: id });
	expect((await node.request('DELETE', route)).status).toBe(404);
	expect((await node.request('GET', '/jobs')).body).toEqual([]);
});
