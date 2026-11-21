import { expect, test, vi } from 'vitest';
import { adapterFixture, adapterIssue, adapterSourceId } from '../../support/trackerAdapterFixture';

test('poll dry-run deduplicates explicit backfill without moving the source cursor', async () => {
	const { database, feed, readIssues, readTimeline, service, store } = adapterFixture({
		redactText: (text) => text.replace('fixture-private', '[redacted]')
	});
	try {
		const issue = adapterIssue({
			title: 'fixture-private',
			created_at: new Date(2_000).toISOString()
		});
		feed.issues = [issue, issue];
		const result = await service.poll(adapterSourceId, { dryRun: true, backfill: true });
		expect(result).toMatchObject({
			status: 'polled',
			dry_run: true,
			actions: [
				{
					action: 'create',
					external_id: '100',
					auto_launch: false,
					title: 'example/widgets #17: [redacted]'
				}
			]
		});
		expect(readIssues.mock.calls[0]?.[1]).toMatchObject({ since: 5_000, backfill: true });
		expect(readTimeline).not.toHaveBeenCalled();
		expect(store.maxSeq()).toBe(0);
		expect(database.prepare('SELECT cursor, last_run FROM adapter_sources').get()).toEqual({
			cursor: 10_000,
			last_run: null
		});
		expect(database.prepare('SELECT node FROM adapter_runner').get()).toBeUndefined();
	} finally {
		database.close();
	}
});

test('poll rejects a different durable owner before contacting the provider', async () => {
	const release = vi.fn();
	const { database, readIssues, service, store } = adapterFixture({
		lease: { owner: 'fixture-owner', tryAcquire: () => release }
	});
	try {
		database.exec("INSERT INTO adapter_runner(slot, node) VALUES (1, 'existing-owner')");
		await expect(service.poll(adapterSourceId)).resolves.toEqual({ status: 'not-owner' });
		expect(release).toHaveBeenCalledOnce();
		expect(readIssues).not.toHaveBeenCalled();
		expect(store.maxSeq()).toBe(0);
	} finally {
		database.close();
	}
});

test('poll distinguishes paused and removed sources from a successful intake', async () => {
	const { database, readIssues, service } = adapterFixture();
	try {
		database.exec('UPDATE adapter_sources SET paused = 1');
		await expect(service.poll(adapterSourceId)).resolves.toEqual({ status: 'inactive' });
		database.exec('UPDATE adapter_sources SET removed = 1');
		await expect(service.poll(adapterSourceId, { dryRun: true })).resolves.toEqual({
			status: 'inactive'
		});
		expect(readIssues).not.toHaveBeenCalled();
	} finally {
		database.close();
	}
});

test('poll uses the start watermark and receives each linked human comment once', async () => {
	const { database, feed, readIssues, service, store } = adapterFixture();
	try {
		readIssues.mockImplementationOnce(async function* () {
			feed.now = 50_000;
			yield adapterIssue();
		});
		const comment = {
			id: 101,
			issue_url: 'https://api.github.com/repos/example/widgets/issues/17',
			created_at: new Date(20_000).toISOString(),
			user: { type: 'User', login: 'fixture-human' }
		};
		feed.comments = [
			comment,
			comment,
			{ ...comment, id: 102, created_at: new Date(9_000).toISOString() },
			{ ...comment, id: 103, user: { type: 'Bot', login: 'fixture-bot' } },
			{ ...comment, id: 104, performed_via_github_app: {} },
			{ ...comment, id: 105, issue_url: 'https://api.github.com/repos/example/other/issues/17' }
		];
		await expect(service.poll(adapterSourceId)).resolves.toMatchObject({ events: 1 });
		expect(database.prepare('SELECT cursor, last_run FROM adapter_sources').get()).toEqual({
			cursor: 30_000,
			last_run: 50_000
		});
		expect(database.prepare('SELECT event_id FROM adapter_events').all()).toEqual([
			{ event_id: 'comment:101' }
		]);
		expect(store.opsSince(1, 10)).toMatchObject([
			{
				actor: adapterSourceId,
				fields: {
					adapter_notice: 'comment:101',
					'note+':
						'GitHub comment by @fixture-human: https://github.com/example/widgets/issues/17#issuecomment-101'
				}
			}
		]);
		await expect(service.poll(adapterSourceId)).resolves.toMatchObject({ events: 0 });
		expect(readIssues.mock.calls[1]?.[1].since).toBe(25_000);
		expect(store.maxSeq()).toBe(2);
	} finally {
		database.close();
	}
});

test('poll rejects a malformed stored source without exposing its configuration', async () => {
	const { database, readIssues, service } = adapterFixture();
	try {
		database.prepare('UPDATE adapter_sources SET config = ?').run('fixture-private invalid JSON');
		await expect(service.poll(adapterSourceId)).rejects.toThrow(/^Invalid Tracker adapter source$/);
		expect(readIssues).not.toHaveBeenCalled();
	} finally {
		database.close();
	}
});

test('poll accepts source-specific presentation and manual matching through an injected policy', async () => {
	const { database, feed, service, store } = adapterFixture({
		intakePolicy: () => ({
			titlePrefix: 'Fixture Widgets',
			matchesItem: (item) => item.agent === 'fixture',
			instructions: 'Read the fixture guide.'
		})
	});
	try {
		store.appendLocal({
			itemId: 'manual-item',
			fields: { title: 'Manual #17', agent: 'fixture', status: 'done' }
		});
		feed.issues.push(adapterIssue({ id: 200, number: 18 }));
		await expect(service.poll(adapterSourceId)).resolves.toMatchObject({
			actions: [
				{ action: 'link', item_id: 'manual-item', title: 'Fixture Widgets #17: Fixture issue' },
				{ action: 'create', title: 'Fixture Widgets #18: Fixture issue' }
			]
		});
		expect(store.opsSince(2, 10)).toMatchObject([
			{ fields: { adapter_instructions: 'Read the fixture guide.' } }
		]);
	} finally {
		database.close();
	}
});
