import { expect } from 'vitest';
import type { TrackerNodeFixture } from './trackerNodeProcess.types';
import { fixtureTrackerJson, trackerProcess } from './trackerNodeProcess';

export async function proveDuplicateIntake(spoke: TrackerNodeFixture, id: string, short: string) {
	expect(
		(await trackerProcess(spoke, ['add', 'Synthetic loopback qualification']).exited).code
	).toBe(5);
	expect(await fixtureTrackerJson(spoke, ['note', short, 'Retain this note'])).toMatchObject({
		id,
		notes_log: expect.arrayContaining([
			{ at: expect.any(String), node: spoke.config.node, text: 'Retain this note' },
			expect.objectContaining({
				text: expect.stringContaining('Duplicate add linked to open Tracker item ' + id)
			})
		])
	});
	expect(await fixtureTrackerJson(spoke, ['needs-attention'])).toContainEqual(
		expect.objectContaining({
			item_id: id,
			kind: 'cos-message',
			reason: expect.stringContaining(id)
		})
	);
}
