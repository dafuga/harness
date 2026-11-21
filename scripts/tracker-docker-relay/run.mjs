// @harness-uid u_5kukrjjivz
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { Database } from 'bun:sqlite';
import { localDocker, runGuest } from './docker.mjs';
import { deniedRequests, relayScope, spokeNode } from './scope.mjs';

const syncRevision = '215f0f57bcf138f4c84da51e88550e52d094db2d';
const project = join(import.meta.dir, '../..');

function prepareGuest(root) {
	const tracker = join(root, 'tracker');
	const inputs = join(tracker, 'pilot');
	const workspace = join(root, 'workspace');
	mkdirSync(inputs, { recursive: true });
	mkdirSync(workspace);
	const archive = execFileSync('git', ['archive', syncRevision, 'src', 'bun.lock'], {
		cwd: project,
		maxBuffer: 32 * 1024 * 1024
	});
	execFileSync('tar', ['-xf', '-'], { cwd: tracker, input: archive });
	assert(readFileSync(join(tracker, 'bun.lock')).equals(readFileSync(join(project, 'bun.lock'))));
	symlinkSync(join(project, 'node_modules'), join(tracker, 'node_modules'), 'dir');
	execFileSync('git', ['apply', '--unidiff-zero', join(import.meta.dir, 'unsigned-spoke.patch')], {
		cwd: tracker
	});
	for (const file of ['guest.mjs', 'frames.mjs', 'scope.mjs']) {
		cpSync(join(import.meta.dir, file), join(inputs, file));
	}
	const bundle = join(workspace, 'guest.js');
	execFileSync(process.execPath, [
		'build',
		join(inputs, 'guest.mjs'),
		'--target=bun',
		'--outfile',
		bundle
	]);
	assert(
		!readFileSync(bundle, 'utf8').includes('TrackerHMAC ts='),
		'Guest includes the HMAC implementation'
	);
	return { tracker, workspace };
}

async function verifySync(docker, task, { hub, store, auth }) {
	const probe = { method: 'GET', pathAndQuery: '/sync/pull?since=0&wait=0' };
	assert.equal((await hub.handle({ ...probe, headers: new Headers() })).status, 401);
	assert.deepEqual(hub.peers(), {});
	const scope = relayScope(async (request) => {
		const headers = new Headers({
			authorization: auth.authorizationHeader(request),
			'content-type': 'application/json',
			'x-tracker-node': spokeNode
		});
		const body = request.body === undefined ? null : new Response(request.body).body;
		const response = await hub.handle({ ...request, headers, body, signal: task.signal });
		assert.equal(response.status, 200, 'The synthetic hub rejected the host signature');
		return [response.status, await response.json()];
	});
	await runGuest(docker, task, scope, []);
	assert.deepEqual(scope.totals, { accepted: 2, denied: deniedRequests.length + 2, malformed: 1 });
	assert.deepEqual(
		store.opsSince(0).map(({ item_id }) => item_id),
		['host-item', 'linux-item']
	);
	assert.deepEqual(Object.keys(hub.peers()), [spokeNode]);
	console.log('PASS: one guest push and pull, both cursors, two signed requests and 14 denials');
}

async function verifyProof(docker, task, tracker) {
	const services = join(tracker, 'src/services');
	const { TrackerSyncAuthService } = await import(
		join(services, 'networking-security/TrackerSyncAuthService.ts')
	);
	const { TrackerHubSyncService } = await import(
		join(services, 'projects-sessions/TrackerHubSyncService.ts')
	);
	const { TrackerPersistenceService } = await import(
		join(services, 'projects-sessions/TrackerPersistenceService.ts')
	);
	const key = randomBytes(32);
	const database = new Database(join(tracker, 'hub.sqlite'));
	try {
		const store = new TrackerPersistenceService(database, 'fixture-hub');
		store.appendLocal({ itemId: 'host-item', fields: { title: 'Host fixture item' } });
		const auth = new TrackerSyncAuthService(key);
		const hub = new TrackerHubSyncService({ auth, store });
		await verifySync(docker, task, { hub, store, auth });
		const oversize = relayScope(() => assert.fail('The oversized frame reached the signer'));
		await assert.rejects(runGuest(docker, task, oversize, ['--oversize']), {
			message: 'Tracker relay frame exceeds 4096 bytes'
		});
		assert.deepEqual(oversize.totals, { accepted: 0, denied: 0, malformed: 0 });
		console.log(
			'PASS: oversized frame aborted before signing and both guest containers were removed'
		);
	} finally {
		database.close();
		key.fill(0);
	}
}

async function main() {
	const [image, ...extra] = process.argv.slice(2);
	assert(
		/^sha256:[a-f0-9]{64}$/.test(image ?? '') && !extra.length,
		'Pass one pinned local image ID'
	);
	const docker = localDocker();
	const [localImage] = JSON.parse(docker('image', 'inspect', image));
	assert.equal(`${localImage.Os}/${localImage.Architecture}`, 'linux/arm64');
	assert.equal(localImage.Config.Volumes ?? null, null);
	const root = mkdtempSync('/tmp/harness-tracker-relay-');
	const interrupt = new AbortController();
	const stop = () => interrupt.abort(new Error('Tracker relay proof interrupted'));
	process.once('SIGINT', stop);
	process.once('SIGTERM', stop);
	try {
		const { tracker, workspace } = prepareGuest(root);
		const signal = AbortSignal.any([interrupt.signal, AbortSignal.timeout(45_000)]);
		await verifyProof(docker, { image, signal, cwd: workspace }, tracker);
	} finally {
		process.removeListener('SIGINT', stop);
		process.removeListener('SIGTERM', stop);
		rmSync(root, { recursive: true, force: true });
		assert(!existsSync(root), 'Task-owned workspace cleanup failed');
	}
	console.log('PASS: isolated bundle, SQLite journal, and scratch workspace removed');
}

await main();
