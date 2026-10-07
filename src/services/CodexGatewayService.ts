import { timingSafeEqual } from 'node:crypto';
import { CodexRequestValidator } from '../validators/CodexRequestValidator';
import { CodexSessionRepository } from '../repositories/CodexSessionRepository';
import { ClaudeGatewayAdapter } from '../adapters/ClaudeGatewayAdapter';
import { gatewayReplay } from '../utils/gatewayReplay';
import { gatewayStream } from '../utils/gatewayStream';

export class CodexGatewayService {
	private readonly repository = new CodexSessionRepository();
	constructor(private readonly config: { token: string }) {}

	async fetch(request: globalThis.Request): Promise<Response> {
		const origin = request.headers.get('origin');
		if (origin) return Response.json({ error: 'Browser origins are not allowed' }, { status: 403 });
		const expected = Buffer.from(`Bearer ${this.config.token}`);
		const received = Buffer.from(request.headers.get('authorization') ?? '');
		if (expected.length !== received.length || !timingSafeEqual(expected, received))
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		if (new URL(request.url).pathname === '/healthz')
			return Response.json({ status: 'ok', prototype: true });
		if (request.method !== 'POST' || new URL(request.url).pathname !== '/v1/responses')
			return Response.json({ error: 'Not found' }, { status: 404 });
		return this.respond(request);
	}

	private async respond(request: globalThis.Request): Promise<Response> {
		try {
			const body = await request.text();
			if (Buffer.byteLength(body) > 4_000_000) throw new Error('Request too large');
			const input = new CodexRequestValidator().parse(JSON.parse(body));
			const id = request.headers.get('thread-id');
			if (!id || id.length > 256) throw new Error('thread-id required');
			const session = this.repository.create(id);
			if (session.emit)
				return Response.json({ error: 'Session has an active response' }, { status: 409 });
			const key = gatewayReplay(input);
			const cached = session.replays.get(key);
			if (cached) return new Response(cached, { headers: { 'Content-Type': 'text/event-stream' } });
			if (session.replays.size >= 16) throw new Error('Prototype request limit reached');
			const adapter = new ClaudeGatewayAdapter(this.repository);
			adapter.validate(input, session);
			const response = gatewayStream(session, this.repository, { key, signal: request.signal });
			adapter.start(input, session);
			return response;
		} catch {
			return Response.json(
				{ error: { code: 'invalid_request', message: 'Unsupported request or tool continuation' } },
				{ status: 400 }
			);
		}
	}
}
