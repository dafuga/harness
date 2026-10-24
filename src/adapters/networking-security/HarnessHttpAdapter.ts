import type { ApiRequest, ApiResponse, HarnessHttpAdapterConfig } from './HarnessHttpAdapter.types';
import { fail } from '../../core/development-tooling/errors';

/** One selected server. Redirects never receive a credential or replay a mutation. */
export class HarnessHttpAdapter {
	readonly origin: string;
	readonly local: boolean;
	constructor(private readonly config: HarnessHttpAdapterConfig) {
		const url = apiOrigin(config.url);
		this.origin = url.origin;
		this.local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
		if (url.protocol !== 'https:' && !(this.local && url.protocol === 'http:'))
			fail('Harness API requires HTTPS except for loopback development servers.');
	}

	async request(method: string, path: string, request: ApiRequest = {}): Promise<ApiResponse> {
		const url = this.address(path, request.query);
		if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method))
			fail('Use a standard HTTP request method.');
		if (['GET', 'HEAD'].includes(method) && request.input !== undefined)
			fail('GET and HEAD take query fields, not a request body.');
		const token = request.token ?? this.config.token;
		const headers = this.headers(request, token);
		const response = await fetch(url, {
			method,
			headers,
			redirect: 'manual',
			body: request.input === undefined ? undefined : JSON.stringify(request.input),
			signal: this.deadline()
		}).catch(() => fail('Harness API request failed or timed out; check the selected server.'));
		return apiResponse(response, token);
	}
	private deadline(): AbortSignal {
		return AbortSignal.timeout(this.config.timeout ?? 30000);
	}
	private headers(request: ApiRequest, token?: string): Headers {
		const headers = new Headers({ accept: 'application/json' });
		if (token) {
			if (/[\r\n]/.test(token)) fail('The API bearer token has invalid characters.');
			headers.set('authorization', `Bearer ${token}`);
		}
		if (this.local) headers.set('origin', this.origin);
		if (request.input !== undefined) headers.set('content-type', 'application/json');
		return headers;
	}

	private address(path: string, query: ApiRequest['query']): URL {
		if (!path.startsWith('/') || path.startsWith('//'))
			fail('Use a same-server absolute API path.');
		const url = new URL(path, this.origin);
		if (url.origin !== this.origin || url.username || url.password || url.hash)
			fail('API requests must stay on the selected server without URL credentials or fragments.');
		for (const [key, field] of query ?? []) url.searchParams.append(key, field);
		return url;
	}
}

function apiOrigin(address: string): URL {
	let url: URL;
	try {
		url = new URL(address);
	} catch {
		return fail('Supply a valid Harness API server origin.');
	}
	if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
		fail('Supply only the API server origin; credentials belong in a token environment variable.');
	return url;
}

async function apiResponse(response: Response, token?: string): Promise<ApiResponse> {
	if (response.status >= 300 && response.status < 400)
		fail(
			`Harness API refused redirect (HTTP ${response.status}); select its destination explicitly.`
		);
	const bytes = new Uint8Array(await response.arrayBuffer());
	const mediaType =
		response.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream';
	const text = new TextDecoder().decode(bytes);
	const data = decodedResponse(text, mediaType);
	if (!response.ok) {
		const code = (data as { error?: unknown } | null)?.error;
		let reason = typeof code === 'string' ? code : response.statusText;
		if (token) reason = reason.replaceAll(token, '[redacted]');
		fail(`Harness API HTTP ${response.status}: ${reason.slice(0, 400)}`);
	}
	return { data, bytes, mediaType };
}

function decodedResponse(text: string, mediaType: string): unknown {
	if (mediaType !== 'application/json' && !mediaType.endsWith('+json')) return text;
	try {
		return text ? JSON.parse(text) : null;
	} catch {
		return fail('Harness API returned invalid JSON.');
	}
}
