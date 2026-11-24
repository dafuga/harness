import { expect } from 'vitest';
import { fixtureTrackerJson } from './trackerNodeProcess';
import type { TrackerFixtureReceipts, TrackerNodeFixture } from './trackerNodeProcess.types';
import { verifyCosDryRun } from './verifyCosDryRun';

export async function verifyReminder(
	hub: TrackerNodeFixture,
	spoke: TrackerNodeFixture,
	id: string,
	receipts: TrackerFixtureReceipts
) {
	const far = new Date(Date.now() + 60_000).toISOString();
	expect(await fixtureTrackerJson(spoke, ['remind', id, '--at', far])).toMatchObject({
		id,
		remind_at: far,
		needs_daniel: true
	});
	await expect.poll(() => fixtureTrackerJson(hub, ['show', id])).toMatchObject({ remind_at: far });
	expect(await fixtureTrackerJson(hub, ['list', '--flagged'])).toEqual([]);
	expect(await fixtureTrackerJson(hub, ['digest'])).toMatchObject({
		needs_daniel: [{ id, remind_at: far, waiting_minutes: expect.any(Number) }]
	});
	verifyCosDryRun(hub, id, false);
	const at = new Date(Date.now() + 2_500).toISOString();
	await fixtureTrackerJson(spoke, ['remind', id, '--at', at]);
	await expect.poll(() => fixtureTrackerJson(hub, ['show', id])).toMatchObject({ remind_at: at });
	await expect
		.poll(() => fixtureTrackerJson(hub, ['list', '--flagged']), { timeout: 9_000 })
		.toMatchObject([{ id, remind_at: at }]);
	await expect
		.poll(
			() => [...receipts.values()].filter(({ path }) => path === '/cos').map(({ body }) => body),
			{
				timeout: 9_000
			}
		)
		.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'attention',
					new: [
						expect.objectContaining({
							id,
							reason: 'remind_at',
							remind_at: at,
							question: 'Is the fixture ready?'
						})
					]
				})
			])
		);
	expect(await fixtureTrackerJson(hub, ['digest'])).toMatchObject({
		needs_daniel: [{ id, remind_at: at }]
	});
	verifyCosDryRun(hub, id);
}
