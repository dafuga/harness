// @harness-uid u_rw64iex44n
import type { TaskSelection } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { hardContextTokens } from './sessionPolicy';
import {
	inputTokenCounter,
	pendingInputTokens,
	requestContext
} from './provider-request-gate/requestContext';
import type {
	CountInputTokens,
	RequestContext
} from './provider-request-gate/requestContext.types';
import { measureResponse } from './provider-request-gate/providerUsageStream';
import { providerDestination, relayHeaders } from './provider-request-gate/providerDestination';

const bodyLimit = 2 * 1024 * 1024;
const transportLimit = 16 * 1024 * 1024;
const framingTokens = 512;

/** Check assembled model requests in the local relay before any bytes are sent upstream. */
export class ProviderRequestGate {
	private last?: RequestContext;
	private lastEstimate = 0;
	private lastMeasured?: number;
	private readonly server: ReturnType<typeof Bun.serve>;
	blockedEstimate?: number;

	constructor(
		private readonly provider: TaskSelection['provider'],
		private readonly observation: () => number | null,
		private readonly forward: typeof globalThis.fetch = globalThis.fetch
	) {
		this.server = Bun.serve({
			hostname: '127.0.0.1',
			port: 0,
			maxRequestBodySize: transportLimit,
			idleTimeout: 0,
			fetch: (request) => this.handle(request)
		});
	}

	get origin() {
		return `http://127.0.0.1:${this.server.port}`;
	}

	async close() {
		await this.server.stop(true);
	}

	private async handle(request: Request): Promise<Response> {
		if (new URL(request.url).host !== new URL(this.origin).host)
			return new Response(null, { status: 400 });
		if (this.blockedEstimate !== undefined) return contextRefusal();
		if (request.method === 'HEAD' && new URL(request.url).pathname === '/api/hello')
			return new Response(null);
		const destination = providerDestination(request, this.provider);
		if (!destination || !['GET', 'POST'].includes(request.method))
			return new Response(null, { status: 404 });
		if (request.headers.has('upgrade')) return new Response(null, { status: 426 });
		try {
			return await this.dispatch(request, destination);
		} catch {
			return new Response(null, { status: 502 });
		}
	}

	private async dispatch(request: Request, destination: URL): Promise<Response> {
		const body = await providerRequestBody(request);
		if (typeof body === 'number') {
			this.blockedEstimate = body;
			return contextRefusal();
		}
		const inference = body !== undefined && !destination.pathname.endsWith('/count_tokens');
		if (inference && !this.admit(body, await inputTokenCounter())) return contextRefusal();
		if (!request.headers.get('authorization') && !request.headers.get('x-api-key'))
			return new Response(null, { status: 401 });
		const admitted = this.last;
		const upstream = await this.forward(destination, {
			method: request.method,
			headers: relayHeaders(request.headers),
			body,
			redirect: 'error',
			signal: request.signal
		});
		const stream = inference
			? measureResponse(upstream, this.provider, (tokens) => {
					if (admitted === this.last) this.lastMeasured = tokens;
				})
			: upstream.body;
		return new Response(stream, {
			status: upstream.status,
			headers: relayHeaders(upstream.headers)
		});
	}

	private admit(body: string, count: CountInputTokens): boolean {
		if (this.blockedEstimate !== undefined) return false;
		const next = requestContext(body, this.last, count);
		if (!next) return false;
		const measured =
			this.lastMeasured ?? (this.last ? this.lastEstimate : (this.observation() ?? 0));
		const pending = Math.ceil(pendingInputTokens(next, this.last) * 1.15);
		const estimate = measured + pending + framingTokens;
		if (estimate >= hardContextTokens) {
			this.blockedEstimate = estimate;
			return false;
		}
		this.last = next;
		this.lastEstimate = estimate;
		this.lastMeasured = undefined;
		return true;
	}
}

/** For bodies too large to tokenize locally, use the byte count as a conservative refusal estimate. */
async function providerRequestBody(request: Request): Promise<string | number | undefined> {
	if (request.method !== 'POST') return undefined;
	const declared = Number(request.headers.get('content-length'));
	if (Number.isSafeInteger(declared) && declared > bodyLimit) return declared;
	const reader = request.body?.getReader();
	if (!reader) return '';
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		for (;;) {
			const chunk = await reader.read();
			if (chunk.done) return Buffer.concat(chunks, size).toString('utf8');
			size += chunk.value.byteLength;
			if (size > bodyLimit) {
				await reader.cancel().catch(() => {});
				return size;
			}
			chunks.push(chunk.value);
		}
	} finally {
		reader.releaseLock();
	}
}

function contextRefusal(): Response {
	return Response.json(
		{ error: { message: 'Harness refused this provider request before dispatch.' } },
		{ status: 400 }
	);
}
