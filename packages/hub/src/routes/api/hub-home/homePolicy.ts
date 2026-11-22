import type {
	HomeAgent,
	HomeChatInput
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { ZodError } from 'zod';
import { hubHttpFailure } from '../[...path]/hub-api-controller/hubHttp';
import { readOverviewText } from '../tracker-overview/trackerOverviewInput';
import { chatId, chatInput, chatOutcome, parseHomePayload } from './homePayload';
import { readHomeSnapshot, storeHome } from './homeStore';
import { chatReceipt, claimChat, finishChat, queueChat } from './homeChatStore';
import type { HomeDeps } from './homePolicy.types';

const root = '/api/hub-home';
const chat = root + '/chat';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
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
	const read = url.pathname === root && request.method === 'GET';
	const actor = owner.actor.id;
	if (read && owner.kind === 'browser' && !url.search)
		return json({
			granted: true,
			snapshot: deps.bucket ? await readHomeSnapshot(deps.bucket, actor, deps.now) : null
		});
	if (owner.kind === 'native' && owner.resource === 'projects')
		return await nativeHome(request, url, deps, actor);
	if (owner.kind === 'browser' && url.pathname === chat)
		return await browserChat(request, url, deps, actor);
	return json({ error: 'not-found' }, 404);
}

async function nativeHome(
	request: Request,
	url: URL,
	deps: HomeDeps,
	actor: string
): Promise<Response> {
	if (url.search || request.method !== 'PUT') return json({ error: 'not-found' }, 404);
	if (!deps.db || !deps.bucket) return json({ error: 'unavailable' }, 503);
	const body: unknown = JSON.parse(
		await readOverviewText(request, url.pathname === root ? 1024 * 1024 : 8192)
	);
	if (url.pathname === root) {
		await storeHome(deps.bucket, actor, parseHomePayload(body), deps.now);
		return json({ messages: await claimChat(deps.db, actor, deps.now) });
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

async function postChat(request: Request, deps: HomeDeps, actor: string) {
	if (!deps.db || !deps.bucket) return json({ error: 'unavailable' }, 503);
	const message = chatInput.parse(JSON.parse(await readOverviewText(request, 8192)));
	const snapshot = await readHomeSnapshot(deps.bucket, actor, deps.now);
	const agent = snapshot?.agents.find((entry) => entry.id === message.agentId);
	if (!matchesCurrentItem(message, agent)) return json({ id: message.id, status: 'refused' });
	const receipt = await queueChat(deps.db, actor, message, deps.now);
	return json(
		receipt ?? { id: message.id, status: 'refused' },
		receipt?.status === 'queued' ? 202 : 200
	);
}

function matchesCurrentItem(message: HomeChatInput, agent: HomeAgent | undefined) {
	if (!agent?.itemId || agent.itemId !== message.itemId) return false;
	return message.kind === 'note' || agent.question === message.question;
}
