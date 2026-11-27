import { ZodError } from 'zod';
import { hubHttpFailure } from '../[...path]/hub-api-controller/hubHttp';
import { readOverviewText } from '../tracker-overview/trackerOverviewInput';
import { quietInput, removalInput, reportInput, subscriptionInput } from './pushPayload';
import { verifiedSender } from './pushSenderProof';
import {
	listSubscriptions,
	readQuiet,
	recordDelivery,
	removeSubscription,
	saveQuiet,
	saveSubscription
} from './pushStore';
import type { PushOwner } from './pushStore.types';
import type { PushDeps, ReadyPushDeps } from './pushPolicy.types';

const root = '/api/push';
const subscriptionPath = root + '/subscription';
const senderPath = root + '/sender';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
const notFound = () => json({ error: 'not-found' }, 404);
const body = async (request: Request) => JSON.parse(await readOverviewText(request, 4096));

/** Without the public key, owner and database, notifications are simply not offered. */
function ready(deps: PushDeps): deps is ReadyPushDeps {
	return Boolean(deps.publicKey && deps.ownerId && deps.origin && deps.db);
}

export async function servePush(request: Request, deps: PushDeps): Promise<Response> {
	try {
		const url = new URL(request.url);
		if (url.search) return notFound();
		if (url.pathname === senderPath) return await sender(request, deps);
		return await browser(request, url.pathname, deps);
	} catch (cause) {
		if (cause instanceof ZodError || cause instanceof SyntaxError)
			return json({ error: 'invalid-input' }, 400);
		const response = hubHttpFailure(cause);
		response.headers.set('Cache-Control', headers['Cache-Control']);
		return response;
	}
}

/** Only the owner's signed-in browser, from the Hub's own origin, manages notifications. */
async function browser(request: Request, path: string, deps: PushDeps): Promise<Response> {
	const read = path === root && request.method === 'GET';
	if (!ready(deps) || !(await ownerBrowser(request, deps)))
		return read ? json({ available: false }) : notFound();
	const store = { db: deps.db, actor: deps.ownerId };
	if (read) return json(await settings(store, deps.publicKey));
	if (path === root) return await changeQuiet(request, store, deps);
	return path === subscriptionPath ? await changeSubscription(request, store, deps) : notFound();
}

async function ownerBrowser(request: Request, deps: ReadyPushDeps) {
	const session = deps.sessions ? await deps.sessions.resolve(request) : null;
	return session?.kind === 'browser' && session.actor.id === deps.ownerId;
}

async function changeQuiet(request: Request, store: PushOwner, deps: ReadyPushDeps) {
	if (request.method !== 'POST') return notFound();
	await saveQuiet(store, quietInput.parse(await body(request)).quiet);
	return json(await settings(store, deps.publicKey));
}

async function changeSubscription(request: Request, store: PushOwner, deps: ReadyPushDeps) {
	if (request.method === 'POST')
		await saveSubscription(store, subscriptionInput.parse(await body(request)), deps.now);
	else if (request.method === 'DELETE')
		await removeSubscription(store, removalInput.parse(await body(request)).endpoint);
	else return notFound();
	return json(await settings(store, deps.publicKey));
}

/** What the page shows. It never returns an address or a key. */
async function settings(store: PushOwner, publicKey: string) {
	const subscriptions = await listSubscriptions(store);
	return {
		available: true,
		publicKey,
		quiet: await readQuiet(store),
		browsers: subscriptions.map(({ id, delivered_at }) => ({ id, deliveredAt: delivered_at }))
	};
}

/** The Tracker hub reads where to deliver, then reports what was delivered or is gone. */
async function sender(request: Request, deps: PushDeps): Promise<Response> {
	if (!ready(deps)) return notFound();
	if (!(await verifiedSender(request, deps))) return json({ error: 'sender-required' }, 401);
	const store = { db: deps.db, actor: deps.ownerId };
	if (request.method === 'GET') {
		const subscriptions = await listSubscriptions(store);
		return json({
			quiet: await readQuiet(store),
			subscriptions: subscriptions.map(({ endpoint, p256dh, auth }) => ({
				endpoint,
				keys: { p256dh, auth }
			}))
		});
	}
	if (request.method !== 'POST') return notFound();
	await recordDelivery(store, reportInput.parse(await body(request)), deps.now);
	return json({ ok: true });
}
