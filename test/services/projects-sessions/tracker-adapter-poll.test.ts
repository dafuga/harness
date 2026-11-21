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
