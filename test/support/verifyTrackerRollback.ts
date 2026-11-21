import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect } from 'vitest';
import type { TrackerNodeFixture } from './trackerNodeProcess.types';

export async function verifyTrackerRollback(root: string, fixture: TrackerNodeFixture, id: string) {
	const release = process.env.HARNESS_TRACKER_TEST_LEGACY_RELEASE;
	if (!release) return;
	const copy = join(root, 'legacy-rollback.sqlite');
	copyFileSync(fixture.config.database, copy);
	const { Store } = await import(pathToFileURL(join(release, 'src', 'store.js')).href);
	const store = new Store(copy, fixture.config.node);
	try {
		expect(store.get(id)).toMatchObject({
			id,
			title: 'Lease fixture survives native restart',
			notes_log: [{ text: 'Native note visible after rollback' }]
		});
		expect(store.opsSince(0)).toMatchObject([
			{ item_id: id, fields: { title: 'Lease fixture survives native restart' } },
			{ item_id: id, fields: { 'note+': 'Native note visible after rollback' } }
		]);
	} finally {
		store.close();
	}
}
