import { chmodSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { join } from 'node:path';
import type { HealthFixtureState } from './trackerHealthFixture.types';

async function answer(
	state: HealthFixtureState,
	request: IncomingMessage,
	response: ServerResponse
) {
	let text = '';
	for await (const chunk of request) text += String(chunk);
	const path = request.url ?? '';
	const method = request.method ?? 'GET';
	const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
	state.requests.push({ method, path, body, headers: request.headers });
	response.setHeader('content-type', 'application/json');
	response.end(JSON.stringify(reply(state, method, path)));
}

/** A loopback stand-in for the native Tracker API with a mutable status and one alert item. */
export async function trackerHealthApi(status: Record<string, unknown>) {
	const state: HealthFixtureState = { status, itemStatus: 'open', requests: [] };
	const server = createServer((request, response) => {
		void answer(state, request, response);
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('no fixture port');
	const close = () => new Promise<void>((resolve) => server.close(() => resolve()));
	return { state, port: address.port, close };
}

function reply(state: HealthFixtureState, method: string, path: string) {
	if (path === '/native/v1/status') return state.status;
	if (path.endsWith('/done')) state.itemStatus = 'done';
	if (path.endsWith('/reopen')) state.itemStatus = 'open';
	return { id: 'health0001', status: state.itemStatus, method };
}

export function healthyHubStatus() {
	return {
		node: 'fixture-hub',
		role: 'hub',
		pid: 4242,
		sync: { hub: 'configured', peers_last_seen: {} },
		webhook: { sender: true, configured: true, outbox: {}, stuck: 0, paused: false, routes: [] },
		backup: { enabled: false }
	};
}

export function unlinkedSpokeStatus() {
	return {
		node: 'fixture-spoke',
		role: 'spoke',
		pid: 4343,
		sync: { connected: false, lastPullOk: '2026-01-15T06:00:00Z', pending_push: 1 }
	};
}

export function healthConfig(
	root: string,
	{ apiPort, syncPort, role }: { apiPort: number; syncPort: number; role: unknown }
) {
	const path = join(root, 'tracker.json');
	writeFileSync(
		path,
		JSON.stringify({
			version: 1,
			...(role === 'spoke'
				? { node: 'fixture-spoke', role, upstream: { url: 'http://127.0.0.1:9' } }
				: { node: 'fixture-hub', role: 'hub', syncPort }),
			database: join(root, 'tracker.sqlite'),
			apiPort,
			legacyFenceFile: join(root, 'fence.json'),
			syncSecretFile: join(root, 'sync.key')
		}),
		{ mode: 0o600 }
	);
	return path;
}

export function privateHealthFile(path: string, text: string) {
	writeFileSync(path, text);
	chmodSync(path, 0o600);
}
