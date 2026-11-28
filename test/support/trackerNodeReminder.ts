import { expect } from 'vitest';
import { fixtureTrackerJson, trackerProcess } from './trackerNodeProcess';
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

export async function verifyProjectFollowUp(hub: TrackerNodeFixture, spoke: TrackerNodeFixture) {
	const { id } = await fixtureTrackerJson(spoke, [
		'add',
		'Synthetic Elan decision',
		'--project',
		'elan',
		'--next-step',
		'Choose pilot scope'
	]);
	const launchedSession = { ...spoke, env: { TRACKER_ITEM_ID: id, TRACKER_RUN_ID: '42' } };
	const short = id.slice(0, 6);
	const refused = await trackerProcess(launchedSession, ['done', short]).exited;
	expect(refused).toMatchObject({ code: 1, stderr: expect.stringContaining('hygiene: closed') });
	expect(await fixtureTrackerJson(spoke, ['show', id])).toMatchObject({ status: 'open' });
	const proof = 'hygiene: closed 2 tabs/windows I opened; left open: shared preview for review';
	const done = await trackerProcess(launchedSession, ['done', short, '--note', proof, '--json'])
		.exited;
	expect(done).toMatchObject({ code: 0, stderr: '' });
	expect(JSON.parse(done.stdout)).toMatchObject({
		id,
		status: 'done',
		needs_daniel: true,
		next_step: 'Choose pilot scope',
		notes_log: expect.arrayContaining([expect.objectContaining({ text: proof })])
	});
	await expect
		.poll(() => fixtureTrackerJson(hub, ['digest']), { timeout: 8_000 })
		.toMatchObject({ needs_daniel: [{ id, project: 'elan', next_step: 'Choose pilot scope' }] });
	await fixtureTrackerJson(spoke, ['park', id, '--until', '2099-11-25', '--by', 'Daniel']);
	await expect
		.poll(() => fixtureTrackerJson(hub, ['list', '--flagged']), { timeout: 8_000 })
		.toEqual([]);
	await fixtureTrackerJson(spoke, ['move-on', id, '--by', 'Daniel']);
	await expect
		.poll(() => fixtureTrackerJson(hub, ['digest']), { timeout: 8_000 })
		.toMatchObject({ needs_daniel: [] });
}
