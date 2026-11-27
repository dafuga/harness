import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { expect } from '../../../../../test/support/browserTest';
import type { ElectronApplication, Page } from '../../../../../test/support/browserTest';
import { enableFixtureStorage, nativeGoogleFixture } from './nativeGoogleFixture';
import type { OverviewSnapshot } from '../../../../reports/src/lib/projects-sessions/project-overview/projectOverview.types';
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

const fixtureActor = (id: string) => ({
	id,
	name: 'Fixture Owner',
	email: 'owner@example.invalid',
	emailVerified: true
});

function nativeSignIn(
	request: IncomingMessage,
	data: string,
	login: ReturnType<typeof nativeGoogleFixture>
) {
	const origin = `http://${request.headers.host}`;
	if (request.url === '/api/auth/native/start') return login.start(data, origin);
	if (request.url !== '/api/auth/native/exchange') return null;
	const proof = login.exchange(data);
	return (
		proof && {
			authorization: OWNER.token,
			actor: fixtureActor(OWNER.id),
			audience: 'harness-desktop',
			resource: proof.resource,
			nonce: proof.nonce,
			expiresAt: new Date(Date.now() + 300_000).toISOString()
		}
	);
}

/** Synthetic browser handoff, account status and Tracker overview. */
async function answer(
	request: IncomingMessage,
	response: ServerResponse,
	records: HubSpyRecord[],
	fixture: {
		readsDenied: boolean;
		overview?: OverviewSnapshot;
		login: ReturnType<typeof nativeGoogleFixture>;
	}
): Promise<void> {
	const path = request.url ?? '';
	const bearer = bearerOf(request);
	const body = await readBody(request);
	records.push({ method: request.method ?? '', path, bearer, body });
	const actor = [OWNER, OTHER].find((known) => known.token === bearer);
	if (path.startsWith('/api/auth/native/') && request.method === 'POST') {
		const result = nativeSignIn(request, body, fixture.login);
		return send(response, result ? 200 : 400, result ?? {});
	}
	if (path === '/api/auth/status' && request.method === 'GET') {
		if (!actor && bearer) return send(response, 401, {});
		return send(response, 200, { configured: true, actor: actor ? fixtureActor(actor.id) : null });
	}
	if (path === '/api/projects' && request.method === 'GET') {
		return send(response, actor ? 200 : 401, actor ? [] : {});
	}
	if (request.method === 'PUT' && path === '/api/tracker-overview') {
		if (actor?.id !== OWNER.id) return send(response, actor ? 403 : 401, {});
		return send(response, 204);
	}
	if (request.method === 'GET' && path === '/api/tracker-overview') {
		if (fixture.readsDenied || actor?.id !== OWNER.id) return send(response, actor ? 403 : 401, {});
		if (fixture.overview) return send(response, 200, fixture.overview);
		const previous = records.findLast(
			(entry) => entry.method === 'PUT' && entry.bearer === OWNER.token
		);
		if (!previous) return send(response, 503, { status: 'unavailable' });
		return send(response, 200, JSON.parse(previous.body));
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
export async function startHubSpy(overview?: OverviewSnapshot): Promise<HubSpy> {
	const records: HubSpyRecord[] = [];
	const fixture = { readsDenied: false, overview, login: nativeGoogleFixture() };
	const server: Server = createServer((request, response) => {
		void answer(request, response, records, fixture);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Hub spy did not bind.');
	return {
		origin: `http://127.0.0.1:${address.port}`,
		records,
		login: fixture.login,
		denyOverviewReads() {
			fixture.readsDenied = true;
		},
		close: () => new Promise<void>((resolve) => server.close(() => resolve()))
	};
}

/** Sets the profile before loading the compiled main. Electron can ignore --user-data-dir. */
export async function makeTemporaryDesktopEntry(temp: string, desktopRoot: string, setup = '') {
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
		${setup}
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
	await enableFixtureStorage(app, profile);
	const file = join(resolve(profile), 'session.enc');
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify({ origin, principalId: actor.id, token: actor.token }), {
		mode: 0o600,
		flag: 'wx'
	});
}

export function electronFixtureEnvironment(): Record<string, string> {
	return Object.fromEntries(
		Object.entries(process.env).filter(
			([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined
		)
	) as Record<string, string>;
}

export async function seedHostedPage(
	app: ElectronApplication,
	profile: string,
	hub: HubSpy
): Promise<Page> {
	const page = await app.firstWindow();
	await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
	await seedHostedSession(app, profile, OWNER, hub.origin);
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	await expect(
		page
			.getByRole('button', { name: 'Account', exact: true })
			.or(page.getByRole('button', { name: 'Sign out', exact: true }))
	).toBeVisible();
	return page;
}

export async function withSeededHub(
	launch: (hub: HubSpy) => Promise<ElectronApplication>,
	profile: string
): Promise<ElectronApplication> {
	const hub = await startHubSpy();
	let app: ElectronApplication | undefined;
	try {
		app = await launch(hub);
		await seedHostedPage(app, profile, hub);
		app.on('close', () => void hub.close());
		return app;
	} catch (error) {
		await app?.close();
		await hub.close();
		throw error;
	}
}
