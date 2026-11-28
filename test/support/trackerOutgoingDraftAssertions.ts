import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect } from 'vitest';
import {
	fixtureTrackerJson,
	loopback,
	trackerProcess,
	verifyDefaultPickup,
	verifyTrackerWire
} from './trackerNodeProcess';
import type { TrackerNodeFixture } from './trackerNodeProcess.types';

export async function verifyDraftAndTrackerWire(
	hub: TrackerNodeFixture,
	spoke: TrackerNodeFixture,
	{ id, syncPort }: { id: string; syncPort: number }
) {
	await verifyDraftCli(hub, spoke, id);
	await verifyDefaultPickup(hub);
	await verifyTrackerWire(syncPort, id);
}

async function verifyDraftCli(hub: TrackerNodeFixture, spoke: TrackerNodeFixture, itemId: string) {
	const id = randomUUID();
	const file = join(dirname(spoke.path), 'outgoing-draft.json');
	writeFileSync(
		file,
		JSON.stringify({
			id,
			itemId,
			message: {
				channel: 'gmail',
				account: 'synthetic-sender',
				to: ['recipient@example.test'],
				cc: [],
				subject: 'Fixture draft',
				body: 'Synthetic unsent body'
			}
		}),
		{ mode: 0o600 }
	);
	const expected = { id, itemId, channel: 'gmail', status: 'draft', delivery: 'idle', revision: 1 };
	expect(await fixtureTrackerJson(spoke, ['draft', 'create', file])).toEqual(expected);
	expect(await fixtureTrackerJson(spoke, ['draft', 'create', file])).toEqual(expected);
	expect(await fixtureTrackerJson(spoke, ['draft', 'list'])).toEqual([expected]);
	expect(await fixtureTrackerJson(hub, ['draft', 'list'])).toEqual([]);
	expect((await trackerProcess(spoke, ['draft', 'send', id]).exited).code).toBe(1);
	const unauthorized = await fetch(
		loopback(spoke.config.apiPort) + '/outgoing-drafts/' + id + '/send',
		{
			method: 'POST',
			headers: { 'X-Tracker-As': 'Daniel' }
		}
	);
	expect(unauthorized.status).toBe(404);
}
