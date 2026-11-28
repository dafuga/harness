import type {
	HomeAgent,
	HomeChatInput,
	HomeOpenAsk,
	HomeReminder,
	OwnerHomeSnapshot
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { ZodError } from 'zod';
import { hubHttpFailure } from '../[...path]/hub-api-controller/hubHttp';
import { browseHomeDocument, uploadHomeDocument } from './homeDocumentPolicy';
import { reconcileHomeDocuments } from './homeDocumentStore';
import { readOverviewText } from '../tracker-overview/trackerOverviewInput';
import { chatId, chatInput, chatOutcome, controlledChange, parseHomePayload } from './homePayload';
import {
	changeControlled,
	readControlled,
	readHomeSnapshot,
	readPublishedHome,
	storeHome
} from './homeStore';
import { chatReceipt, claimChat, finishChat, queueChat } from './homeChatStore';
import { ringAccount } from '../sync/syncAccount';
import type { HomeDeps } from './homePolicy.types';

const root = '/api/hub-home';
const chat = root + '/chat';
const agentsPath = root + '/agents';
const documentPath = root + '/doc';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
// Up to 65 plans with four 24 KiB stage artifacts, plus the existing Home snapshot.
const maxHomeBytes = 8 * 1024 * 1024;
const unreadable = { granted: false, snapshot: null };

async function verifiedOwner(request: Request, deps: HomeDeps) {
	if (!deps.ownerId || !deps.sessions) return null;
	const session = await deps.sessions.resolve(request);
	return session?.actor.id === deps.ownerId ? session : null;
}

export async function serveHubHome(request: Request, deps: HomeDeps): Promise<Response> {
	const url = new URL(request.url);
	const read = url.pathname === root && request.method === 'GET';
	try {
		const owner = await verifiedOwner(request, deps);
		if (!owner) return read ? json(unreadable) : json({ error: 'not-found' }, 404);
		return await dispatchHome(request, url, deps, owner);
	} catch (cause) {
		if (cause instanceof ZodError || cause instanceof SyntaxError)
			return json({ error: 'invalid-input' }, 400);
		const response = hubHttpFailure(cause);
		response.headers.set('Cache-Control', headers['Cache-Control']);
		return response;
	}
}

async function dispatchHome(
	request: Request,
	url: URL,
	deps: HomeDeps,
	owner: { actor: { id: string }; kind: string; resource: string }
) {
	const actor = owner.actor.id;
	if (owner.kind === 'native' && owner.resource === 'projects')
		return await nativeHome(request, url, deps, actor);
	if (owner.kind === 'browser') return await browserHome(request, url, deps, actor);
	return json({ error: 'not-found' }, 404);
}

async function browserHome(request: Request, url: URL, deps: HomeDeps, actor: string) {
	if (url.pathname === root && request.method === 'GET')
		return await browserSnapshot(url, deps, actor);
	if (url.pathname === chat) return await browserChat(request, url, deps, actor);
	if (url.pathname === documentPath && request.method === 'GET') {
		const found = await browseHomeDocument(url, deps, actor);
		return json(found.body, found.status);
	}
	if (url.pathname === agentsPath) return await browserAgents(request, url, deps, actor);
	return json({ error: 'not-found' }, 404);
}

async function browserSnapshot(url: URL, deps: HomeDeps, actor: string) {
	if (url.search) return json({ error: 'not-found' }, 404);
	return json({
		granted: true,
		snapshot: deps.bucket ? await readHomeSnapshot(deps.bucket, actor, deps.now) : null,
		controlled: deps.bucket ? await readControlled(deps.bucket, actor) : [],
		...(deps.accounts && { live: true }),
		...(deps.outgoingDrafts && { outgoingDrafts: true })
	});
}

async function nativeHome(
	request: Request,
	url: URL,
	deps: HomeDeps,
	actor: string
): Promise<Response> {
	if (url.search || request.method !== 'PUT') return json({ error: 'not-found' }, 404);
	if (!deps.db || !deps.bucket) return json({ error: 'unavailable' }, 503);
	if (url.pathname === documentPath) {
		const stored = await uploadHomeDocument(request, deps, actor);
		return json(stored.body, stored.status);
	}
	const body: unknown = JSON.parse(
		await readOverviewText(request, url.pathname === root ? maxHomeBytes : 8192)
	);
	if (url.pathname === root) {
		const snapshot = parseHomePayload(body);
		await storeHome(deps.bucket, actor, snapshot, deps.now);
		const wantDocs = await reconcileHomeDocuments(deps.bucket, actor, snapshot);
		await ringAccount(deps.accounts, actor, 'home');
		return json({
			messages: await claimChat(deps.db, actor, deps.now),
			...(wantDocs.length && { wantDocs })
		});
	}
	if (url.pathname !== chat) return json({ error: 'not-found' }, 404);
	await finishChat(deps.db, actor, chatOutcome.parse(body));
	return json({ ok: true });
}

async function browserChat(
	request: Request,
	url: URL,
	deps: HomeDeps,
	actor: string
): Promise<Response> {
	if (!deps.db || !deps.bucket) return json({ error: 'unavailable' }, 503);
	if (request.method === 'GET') {
		const id = chatId.parse(url.searchParams.get('id'));
		return json((await chatReceipt(deps.db, actor, id, deps.now)) ?? { id, status: 'unconfirmed' });
	}
	if (request.method !== 'POST' || url.search) return json({ error: 'not-found' }, 404);
	return await postChat(request, deps, actor);
}

/** Daniel adds or removes a session he controls himself; only those are listed under Agents. */
async function browserAgents(
	request: Request,
	url: URL,
	deps: HomeDeps,
	actor: string
): Promise<Response> {
	const add = request.method === 'POST';
	if (!deps.bucket) return json({ error: 'unavailable' }, 503);
	if ((!add && request.method !== 'DELETE') || url.search) return json({ error: 'not-found' }, 404);
	const change = controlledChange.parse(JSON.parse(await readOverviewText(request, 1024)));
	const controlled = await changeControlled(deps.bucket, actor, { id: change.id, add });
	if (!controlled) return json({ error: 'too-many' }, 409);
	await ringAccount(deps.accounts, actor, 'home');
	return json({ controlled });
}

async function postChat(request: Request, deps: HomeDeps, actor: string) {
	if (!deps.db || !deps.bucket) return json({ error: 'unavailable' }, 503);
	const message = chatInput.parse(JSON.parse(await readOverviewText(request, 8192)));
	const snapshot = await readPublishedHome(deps.bucket, actor, deps.now);
	if (!snapshot || !matchesHome(message, snapshot))
		return json({ id: message.id, status: 'refused' });
	const receipt = await queueChat(deps.db, actor, message, deps.now);
	if (receipt?.status === 'queued') await ringAccount(deps.accounts, actor, 'chat');
	return json(
		receipt ?? { id: message.id, status: 'refused' },
		receipt?.status === 'queued' ? 202 : 200
	);
}

function matchesHome(message: HomeChatInput, snapshot: OwnerHomeSnapshot) {
	if (message.armed) return matchesListedReminder(message, snapshot.reminders);
	return matchesCurrentItem(message, snapshot);
}

/** A reminder tap must name a listed reminder at the time it is still armed for. */
function matchesListedReminder(message: HomeChatInput, reminders: HomeReminder[] = []) {
	return reminders.some((entry) => entry.itemId === message.itemId && entry.at === message.armed);
}

function matchesCurrentItem(message: HomeChatInput, snapshot: OwnerHomeSnapshot) {
	const agent = snapshot.agents.find((entry) => entry.id === message.agentId);
	if (message.kind === 'message') return matchesMessageTarget(message, agent);
	if (message.kind === 'note') return agent?.itemId === message.itemId;
	const ask = answerTarget(message, snapshot.openAsks, agent);
	if (!ask || ask.question !== message.question) return false;
	return message.option === undefined || matchesChosenOption(message, ask);
}

function answerTarget(message: HomeChatInput, asks?: HomeOpenAsk[], agent?: HomeAgent) {
	if (asks)
		return asks.find(
			(entry) => entry.agentId === message.agentId && entry.itemId === message.itemId
		);
	return agent?.itemId === message.itemId ? agent : undefined;
}

/** Chief of Staff is always reachable; a session message names the live run it was shown. */
function matchesMessageTarget(message: HomeChatInput, agent: HomeAgent | undefined) {
	if (message.agentId === 'cos') return true;
	return Boolean(agent?.runId) && agent?.itemId === message.itemId && agent.runId === message.runId;
}

/** A tap must name a real option of the open ask, and a deploy, money or secret ask must be confirmed. */
function matchesChosenOption(message: HomeChatInput, ask: HomeAgent | HomeOpenAsk) {
	const chosen = ask.options?.[(message.option ?? 0) - 1];
	if (!chosen || message.text !== chosen.label) return false;
	return !ask.confirm || message.confirmed === true;
}
