import { consoleAgent } from '../../../services/ConsoleAgentService';
/** The owner guard covers this route. Mutation additionally requires browser same-origin JSON. */
export class ConsoleAgentController {
	async handle(request: Request): Promise<Response> {
		const refusal = ownerRequestRefusal(request);
		if (refusal) return refusal;
		const bytes = await request.arrayBuffer();
		if (bytes.byteLength > 128000) return new Response(null, { status: 413 });
		try {
			const input: unknown = JSON.parse(new TextDecoder().decode(bytes));
			if (!input || typeof input !== 'object' || Array.isArray(input))
				throw new Error('Invalid request.');
			const payload = input as Record<string, unknown>;
			const bearer = request.headers.get('authorization');
			if (bearer?.startsWith('Bearer ')) payload.token = bearer.slice(7);
			return apiReply(await consoleAgent(payload));
		} catch (cause) {
			return Response.json(
				{ error: cause instanceof Error ? cause.message : 'Chat unavailable.' },
				{ status: 400 }
			);
		}
	}
}

/** The same artifact bytes as the hosted API, without JSON numeric-key conversion. */
function apiReply(value: unknown): Response {
	if (value instanceof Uint8Array)
		return new Response(new Uint8Array(value), { headers: { 'content-type': 'image/png' } });
	const artifact = value as { bytes?: unknown; mediaType?: unknown } | null;
	if (artifact?.bytes instanceof Uint8Array && typeof artifact.mediaType === 'string')
		return new Response(new Uint8Array(artifact.bytes), {
			headers: { 'content-type': artifact.mediaType, 'x-content-type-options': 'nosniff' }
		});
	return Response.json(value);
}

function ownerRequestRefusal(request: Request): Response | null {
	const url = new URL(request.url);
	if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
		return Response.json({ error: 'host-denied' }, { status: 403 });
	if (request.method !== 'POST') return new Response(null, { status: 405 });
	if (
		request.headers.get('origin') !== url.origin ||
		request.headers.get('sec-fetch-site') === 'cross-site'
	)
		return Response.json({ error: 'origin-denied' }, { status: 403 });
	if (!request.headers.get('content-type')?.startsWith('application/json'))
		return Response.json({ error: 'json-required' }, { status: 415 });
	return null;
}
