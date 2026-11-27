// @harness-uid u_7knh6lpstr
import type { SyncHttpDeps } from './SyncHttp.types';
import { isScopeId, syncLimits } from './syncWire';
import { readJsonBody } from '../../../utils/development-tooling/readJsonBody';

/** What a poke says changed: the op log or the objects of a scope. */
const kinds = ['ops', 'objects'];
/** What a content-free change notice may name. */
const topics = ['home', 'chat'];
const json = (body: unknown, status = 200) => Response.json(body, { status });
const failure = (status: number, error: string) => json({ error }, status);

/** What the Hub may ask of the account object. Only a namespace binding reaches it. */
export class SyncHttp {
	constructor(private readonly deps: SyncHttpDeps) {}

	async handle(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const parts = url.pathname.split('/').filter(Boolean);
		if (parts[0] === 'live' && request.method === 'GET') return this.live(request, url);
		if (parts[0] === 'poke' && request.method === 'POST') return this.poke(request);
		if (parts[0] === 'changed' && request.method === 'POST') return this.changed(request);
		if (parts[0] === 'enroll') return this.enroll(request, parts[1]);
		return failure(404, 'not-found');
	}

	private live(request: Request, url: URL): Response {
		if (request.headers.get('Upgrade') !== 'websocket') return failure(426, 'upgrade-required');
		const client = this.deps.sockets.open(url.searchParams.get('device') ?? '');
		const protocol = request.headers.get('Sec-WebSocket-Protocol');
		const headers: Record<string, string> = protocol ? { 'Sec-WebSocket-Protocol': protocol } : {};
		return new Response(null, { status: 101, webSocket: client, headers });
	}

	private async changed(request: Request): Promise<Response> {
		const body = await readJsonBody(request, false);
		const topic = String(body?.topic);
		if (!topics.includes(topic)) return failure(400, 'invalid');
		this.deps.sockets.changed(topic);
		return new Response(null, { status: 204 });
	}

	private async poke(request: Request): Promise<Response> {
		const body = await readJsonBody(request, false);
		if (
			!body ||
			typeof body.scope !== 'string' ||
			!isScopeId(body.scope) ||
			!Number.isSafeInteger(body.seq) ||
			!kinds.includes(String(body.kind))
		)
			return failure(400, 'invalid');
		this.deps.sockets.poke(body.scope, Number(body.seq), String(body.kind));
		return new Response(null, { status: 204 });
	}

	private async enroll(request: Request, id: string | undefined): Promise<Response> {
		const now = this.deps.now();
		if (request.method === 'GET') return this.readEnroll(id, now);
		if (request.method !== 'POST') return failure(405, 'method');
		const body = await readJsonBody(request, false);
		const by = body?.by,
			text = body?.body;
		if (typeof by !== 'string' || typeof text !== 'string' || text.length > syncLimits.stepBytes)
			return failure(400, 'invalid');
		if (id === undefined) return this.openEnroll(by, text, now);
		const step = this.deps.enrollments.append(id, by, text, now);
		if (!step) return failure(409, 'enrollment-unavailable');
		this.deps.sockets.announce({ id, n: step.n });
		return json(step, 201);
	}

	private readEnroll(id: string | undefined, now: number): Response {
		if (id === undefined) return json({ requests: this.deps.enrollments.pending(now) });
		const view = this.deps.enrollments.read(id, now);
		return view ? json(view) : failure(404, 'not-found');
	}

	private async openEnroll(by: string, body: string, now: number): Promise<Response> {
		const opened = this.deps.enrollments.open(by, body, now);
		if (!opened) return failure(429, 'too-many-requests');
		if (!opened.created) return json(opened.view);
		await this.deps.sweep();
		this.deps.sockets.announce({ id: opened.view.id, n: 0 });
		return json(opened.view, 201);
	}
}
