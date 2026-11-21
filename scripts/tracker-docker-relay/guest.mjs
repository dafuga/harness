// @harness-uid u_zbrkhvcaat
import assert from 'node:assert/strict';
import { Database } from 'bun:sqlite';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import process from 'node:process';
import { TrackerPersistenceService } from '../src/services/projects-sessions/TrackerPersistenceService';
import { TrackerSpokeSyncService } from '../src/services/projects-sessions/TrackerSpokeSyncService';
import { readFrames, writeFrame } from './frames.mjs';
import { deniedRequests, fixtureClock, spokeItem, spokeNode } from './scope.mjs';

function assertIsolation() {
	assert.equal(process.platform, 'linux');
	assert(process.getuid() > 0);
	assert.deepEqual(Object.keys(networkInterfaces()), ['lo'], 'Addressed guest network interfaces');
	assert.deepEqual(readdirSync('/workspace'), ['guest.js'], 'Guest workspace files');
	assert(!existsSync('/var/run/docker.sock'));
	assert.equal(process.env.HOME, '/tmp');
	assert(!existsSync('/Users'));
	assert(!existsSync('/tmp/.config/tracker'));
	assert(
		!Object.keys(process.env).some((name) => /tracker|secret|token|api.key|docker.host/i.test(name))
	);
	assert.throws(() => writeFileSync('/relay-root-write', ''), { code: 'EROFS' });
}

const frames = readFrames(process.stdin);
async function exchange(frame) {
	await writeFrame(process.stdout, frame);
	const { value, done } = await frames.next();
	assert(!done, 'Host relay closed before its reply');
	assert(!value.includes('TrackerHMAC '), 'Host authorization leaked in a guest reply');
	return JSON.parse(value);
}

async function verifyRoundTrip(store) {
	for (const [index, denied] of deniedRequests.entries()) {
		assert.deepEqual(await exchange(JSON.stringify(denied)), [403], `Denial case ${index + 1}`);
	}
	assert.deepEqual(await exchange('{'), [400], 'Malformed JSON denial');
	const sent = [];
	const service = new TrackerSpokeSyncService({
		store,
		pullWaitSeconds: 0,
		transport: async ({ method, pathAndQuery, body, ...metadata }) => {
			assert.deepEqual(Object.keys(metadata), ['timeoutMs'], 'Unsigned spoke request metadata');
			const tuple = body === undefined ? [method, pathAndQuery] : [method, pathAndQuery, body];
			sent.push(tuple);
			const [status, result] = await exchange(JSON.stringify(tuple));
			assert.equal(status, 200, `Expected admitted ${method} request`);
			return result;
		}
	});
	store.appendLocal(spokeItem);
	assert.equal(await service.push(), 1);
	assert.deepEqual(
		await service.pull(),
		{ status: 'applied', last: 2, hub: 'fixture-hub' },
		'Pull result'
	);
	assert.equal(store.getMeta('pushed_seq'), '1');
	assert.equal(store.getMeta('pull_cursor'), '2');
	assert.deepEqual(
		store.opsSince(0).map(({ item_id }) => item_id),
		['linux-item', 'host-item'],
		'Guest SQLite rows'
	);
	for (const replay of sent) {
		assert.deepEqual(await exchange(JSON.stringify(replay)), [403], 'Replay denial');
	}
}

async function main() {
	assertIsolation();
	if (process.argv[2] === '--oversize') {
		// Withhold the newline to exercise the incomplete-frame byte limit.
		await new Promise((resolve) => process.stdout.write('x'.repeat(4097), resolve));
		await frames.next();
		throw new RangeError('Host relay accepted an oversized frame');
	}
	const database = new Database('/tmp/spoke.sqlite');
	try {
		await verifyRoundTrip(
			new TrackerPersistenceService(database, spokeNode, { now: () => fixtureClock })
		);
	} finally {
		database.close();
		await frames.return();
	}
}

await main().catch((error) => {
	process.stderr.write(`Guest assertion failed: ${error.message.split('\n')[0]}\n`);
	process.exitCode = 1;
});
