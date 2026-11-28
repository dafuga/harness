import { expect } from 'vitest';
import { fixtureTrackerJson } from './trackerNodeProcess';
import type { TrackerNodeFixture } from './trackerNodeProcess.types';

const question = 'Is the fixture ready?';

/** A session flag stays private on both nodes until Chief of Staff releases it. */
export async function verifyReviewedFlag(
	hub: TrackerNodeFixture,
	spoke: TrackerNodeFixture,
	id: string,
	choices: string[]
) {
	expect(await fixtureTrackerJson(spoke, ['flag', id, question, ...choices])).toMatchObject({
		needs_daniel: false,
		review_status: 'awaiting Chief of Staff review'
	});
	await expect
		.poll(() => fixtureTrackerJson(hub, ['review', id, '--by', 'Chief of Staff']))
		.toMatchObject({ review: { fields: { question } } });
	expect(await fixtureTrackerJson(hub, ['list', '--flagged'])).toEqual([]);
	const release = ['release', id, question, ...choices, '--by', 'Chief of Staff'];
	expect(await fixtureTrackerJson(spoke, release)).toMatchObject({ needs_daniel: true });
}
