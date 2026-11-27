import { TrackerSyncAuthService } from '../../src/services/networking-security/TrackerSyncAuthService';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import { expect } from 'vitest';
import type { TrackerNodeConfig } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import type { TrackerFixtureResult, TrackerNodeFixture } from './trackerNodeProcess.types';

const shim = resolve('scripts/tracker-shim.sh');
const command = resolve('src/cli/index.ts');
export const trackerFixtureKey = 'synthetic-test-sync-key-2026';

export async function freeTrackerPorts(count: number): Promise<number[]> {
	const listeners = Array.from({ length: count }, () => createServer());
	try {
		return await Promise.all(
			listeners.map(async (listener) => {
				listener.listen(0, '127.0.0.1');
				await once(listener, 'listening');
				const address = listener.address();
				if (!address || typeof address === 'string' || [7701, 7702].includes(address.port))
					throw new Error('Invalid fixture port');
				return address.port;
			})
		);
	} finally {
		await Promise.all(
			listeners.map((listener) => new Promise<void>((resolve) => listener.close(() => resolve())))
		);
	}
}

export function trackerFixtureFiles(root: string): void {
	mkdirSync(join(root, 'home'));
	privateFixture(join(root, 'sync.key'), trackerFixtureKey);
	writeFileSync(join(root, 'harness'), '#!/bin/sh\nexec bun "$TRACKER_FIXTURE_ENTRY" "$@"\n', {
		mode: 0o700
	});
	writeFileSync(
		join(root, 'legacy'),
		'#!/bin/sh\nprintf used > "$TRACKER_FIXTURE_LEGACY_MARKER"\nexit 99\n',
		{ mode: 0o700 }
	);
}

export function writeTrackerFixture(root: string, config: TrackerNodeConfig): TrackerNodeFixture {
	const path = join(root, `${config.node}.json`);
	privateFixture(path, config);
	writeTrackerFence(config);
	return { path, config };
}

export function writeTrackerFence(config: TrackerNodeConfig): void {
	privateFixture(config.legacyFenceFile, {
		version: 1,
		checkpoint: 'fixture-migration-01',
		hostEffects: config.hostEffects?.mode === 'active' ? true : undefined,
		legacyAutostart: 'disabled',
		node: config.node,
		role: config.role,
		database: config.database,
		apiPort: config.apiPort,
		syncPort: config.role === 'hub' ? config.syncPort : config.peer?.listenPort,
		legacySupervisorSocket: config.legacySupervisorSocket
	});
}

export function fixtureConfig(root: string, node: string, apiPort: number) {
	const database = join(root, `${node}.sqlite`);
	privateFixture(database, '');
	new DatabaseSync(database).close();
	return {
		version: 1 as const,
		node,
		database,
		apiPort,
		syncSecretFile: join(root, 'sync.key'),
		legacyFenceFile: join(root, `${node}-fence.json`)
	};
}

export function privateFixture(path: string, data: string | object) {
	writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data), { mode: 0o600 });
}

export function trackerFixtureEnv(fixture: TrackerNodeFixture) {
	const root = resolve(fixture.path, '..');
	return {
		HOME: join(root, 'home'),
		PATH: process.env.PATH,
		TMPDIR: process.env.TMPDIR,
		HARNESS_EXECUTABLE: process.env.HARNESS_TRACKER_TEST_BIN ?? join(root, 'harness'),
		HARNESS_TRACKER_CONFIG: fixture.path,
		HARNESS_TRACKER_LEGACY_BIN: join(root, 'legacy'),
		TRACKER_FIXTURE_ENTRY: command,
		TRACKER_FIXTURE_LEGACY_MARKER: join(root, 'legacy-used'),
		TRACKER_AS: 'synthetic-attestation'
	};
}

export function trackerProcess(fixture: TrackerNodeFixture, args: string[]) {
	const env = trackerFixtureEnv(fixture);
	const child = spawn('/bin/bash', [shim, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
	let stdout = '';
	let stderr = '';
	child.stdout.setEncoding('utf8').on('data', (data: string) => {
		stdout += data;
	});
	child.stderr.setEncoding('utf8').on('data', (data: string) => {
		stderr += data;
	});
	const exited = once(child, 'close').then(
		([code]): TrackerFixtureResult => ({ code, stdout, stderr })
	);
	return { child, exited };
}

export async function finishedTrackerProcess(fixture: TrackerNodeFixture, args: string[]) {
	const { child, exited } = trackerProcess(fixture, args);
	const timeout = setTimeout(() => child.kill('SIGKILL'), 8_000);
	try {
		return await exited;
	} finally {
		clearTimeout(timeout);
	}
}

export function serveTrackerArgs(fixture: TrackerNodeFixture) {
	return ['serve', '--config', fixture.path, '--role', fixture.config.role];
}

export async function startTrackerFixture(fixture: TrackerNodeFixture) {
	const { child, exited } = trackerProcess(fixture, serveTrackerArgs(fixture));
	const output = createInterface({ input: child.stdout });
	const stop = async () => {
		child.kill('SIGTERM');
		const timer = setTimeout(() => child.kill('SIGKILL'), 8_000);
		try {
			return await exited;
		} finally {
			clearTimeout(timer);
		}
	};
	try {
		const line = once(output, 'line', { signal: AbortSignal.timeout(8_000) });
		const ready = await Promise.race([
			line.then(([text]) => JSON.parse(text)),
			exited.then(({ code, stderr }) => {
				throw new Error(`Tracker fixture startup exited ${code}: ${stderr}`);
			})
		]);
		return { ready, stop };
	} catch (error) {
		await stop();
		throw error;
	} finally {
		output.close();
	}
}

export async function fixtureTrackerJson(fixture: TrackerNodeFixture, args: string[]) {
	const result = await finishedTrackerProcess(fixture, [...args, '--json']);
	if (result.code !== 0) throw new Error(`Tracker CLI exited ${result.code}: ${result.stderr}`);
	return JSON.parse(result.stdout);
}

export function loopback(port: number) {
	return `http://127.0.0.1:${port}`;
}

export async function verifyTrackerWire(port: number, id: string) {
	const pathAndQuery = '/sync/pull?since=0&wait=0';
	const url = loopback(port) + pathAndQuery;
	expect((await fetch(url)).status).toBe(401);
	const authorization = new TrackerSyncAuthService(trackerFixtureKey).authorizationHeader({
		method: 'GET',
		pathAndQuery
	});
	const response = await fetch(url, {
		headers: { authorization, 'x-tracker-node': 'synthetic-observer' }
	});
	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({
		hub: 'synthetic-hub',
		ops: expect.arrayContaining([
			expect.objectContaining({ item_id: id, actor: 'synthetic-attestation' })
		])
	});
	expect((await fetch(loopback(port) + '/items', { method: 'POST', body: '{}' })).status).toBe(404);
}

export async function verifyDefaultPickup(hub: TrackerNodeFixture) {
	const ready = await fixtureTrackerJson(hub, [
		'add',
		'Synthetic delegated work',
		'--by',
		'Chief of Staff'
	]);
	const later = await fixtureTrackerJson(hub, [
		'add',
		'Synthetic deferred paperwork',
		'--by',
		'Daniel',
		'--later'
	]);
	expect(ready).toMatchObject({ auto: expect.any(String), launch_target: 'synthetic-hub' });
	expect(ready.launch_source).toBe('automatic');
	expect(later).toMatchObject({ auto: null, schedule_off: true });
	expect(await fixtureTrackerJson(hub, ['digest'])).toMatchObject({
		queued: [{ id: ready.id, waiting_minutes: expect.any(Number) }]
	});
	await fixtureTrackerJson(hub, ['done', ready.id]);
	await fixtureTrackerJson(hub, ['done', later.id]);
}
