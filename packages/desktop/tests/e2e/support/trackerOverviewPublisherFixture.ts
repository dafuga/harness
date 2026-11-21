import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { ElectronApplication } from '../../../../../test/support/browserTest';
import type { HubSpy, HubSpyRecord } from './trackerOverviewPublisherFixture.types';
export type { HubSpy, HubSpyRecord } from './trackerOverviewPublisherFixture.types';

/** Synthetic owner and non-owner Hub identities. The tokens are fixture values, never secrets. */
export const OWNER = { id: 'fixture-owner', token: 'fixture-owner-token' };
export const OTHER = { id: 'fixture-other-actor', token: 'fixture-other-token' };

/** Reads the request body as text; the spy never stores it beyond the synthetic run. */
function readBody(request: IncomingMessage): Promise<string> {
	return new Promise((resolve) => {
		let text = '';
		request.setEncoding('utf8');
		request.on('data', (chunk: string) => (text += chunk));
		request.on('end', () => resolve(text));
	});
}

/** The bearer token from the Authorization header, or null when none was sent. */
function bearerOf(request: IncomingMessage): string | null {
	const header = request.headers.authorization ?? '';
	return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

/** Answers the two calls the publisher makes: the status check and the owner-only PUT. */
async function answer(
	request: IncomingMessage,
	response: ServerResponse,
	records: HubSpyRecord[]
): Promise<void> {
	const path = request.url ?? '';
	const bearer = bearerOf(request);
	const body = await readBody(request);
	records.push({ method: request.method ?? '', path, bearer, body });
	const actor = [OWNER, OTHER].find((known) => known.token === bearer);
	if (request.method === 'GET' && path === '/api/auth/status') {
		if (!actor) return send(response, 401, {});
		return send(response, 200, {
			configured: true,
			actor: { id: actor.id, emailVerified: true }
		});
	}
	if (request.method === 'PUT' && path === '/api/tracker-overview') {
		if (actor?.id !== OWNER.id) return send(response, actor ? 403 : 401, {});
		return send(response, 204);
	}
	return send(response, 404, {});
}

function send(response: ServerResponse, status: number, body?: unknown): void {
	response.writeHead(status, { 'content-type': 'application/json' });
	response.end(body === undefined ? undefined : JSON.stringify(body));
}

/**
 * A loopback Hub spy. It is the only Hub the publisher is pointed at, and it records each request
 * the real main-process publisher sends, so the spec can assert the wire: path, bearer and body.
 */
export async function startHubSpy(): Promise<HubSpy> {
	const records: HubSpyRecord[] = [];
	const server: Server = createServer((request, response) => {
		void answer(request, response, records);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Hub spy did not bind.');
	return {
		origin: `http://127.0.0.1:${address.port}`,
		records,
		close: () => new Promise<void>((resolve) => server.close(() => resolve()))
	};
}

/** Sets the profile before loading the compiled main. Electron can ignore --user-data-dir. */
export async function makeTemporaryDesktopEntry(temp: string, desktopRoot: string) {
	const entry = join(temp, 'entry');
	const profile = join(temp, 'profile');
	await mkdir(entry);
	await mkdir(profile);
	await writeFile(
		join(entry, 'package.json'),
		JSON.stringify({ name: 'harness-fixture', main: 'entry.cjs' })
	);
	await writeFile(
		join(entry, 'entry.cjs'),
		`
		const { app } = require('electron');
		app.setPath('userData', ${JSON.stringify(profile)});
		app.setAppPath(${JSON.stringify(desktopRoot)});
		require(${JSON.stringify(join(desktopRoot, 'dist/main.cjs'))});
	`
	);
	return entry;
}

/**
 * Seeds the synthetic hosted session in this app's temporary profile. The SSH-launched fixture
 * has no unlocked Keychain, so substitute only the main process's OS storage boundary.
 */
export async function seedHostedSession(
	app: ElectronApplication,
	profile: string,
	actor: { id: string; token: string },
	origin: string
): Promise<void> {
	const userData = await app.evaluate(({ app, safeStorage }) => {
		Object.assign(safeStorage, {
			isEncryptionAvailable: () => true,
			decryptString: (bytes: Buffer) => bytes.toString('utf8')
		});
		return app.getPath('userData');
	});
	if (resolve(userData) !== resolve(profile))
		throw new Error('Expected the temporary Electron profile.');
	const file = join(userData, 'session.enc');
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify({ origin, principalId: actor.id, token: actor.token }), {
		mode: 0o600,
		flag: 'wx'
	});
}
