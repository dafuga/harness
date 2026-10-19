import { Query, ApiFailure, BrowserApi } from '../../utils/browserApi';
import { hostedResponse } from '$desktop/utils/hostedResponse';
import { artifactLimit } from '$desktop/utils/artifactMedia';
import { browserError } from '../../utils/browserError';

/** A request that hangs must not hold the workspace: reads there are done one at a time. */
const patience = 30000;

function address(path: string, query: Query = {}): string {
	if (!path.startsWith('/api/')) throw new Error('Only the API of this site is called.');
	const set = Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1]));
	return set.length ? `${path}?${new URLSearchParams(set)}` : path;
}

async function failure(response: Response): Promise<ApiFailure> {
	const body: unknown = await response.json().catch(() => null);
	const stated = body && typeof body === 'object' && 'error' in body ? body.error : '';
	const code = typeof stated === 'string' ? stated : '';
	return Object.assign(new Error(browserError(code, response.status)), {
		status: response.status,
		code
	});
}

/**
 * The same-origin API as the signed-in browser reaches it. The session is a cookie the page
 * cannot read; nothing here adds a credential to a header or to an address. `failed` hears of
 * every coded refusal, so a page can notice that its session ended.
 */
export function browserApi(
	fetcher: typeof fetch = fetch,
	failed: (failure: ApiFailure) => void = () => {}
): BrowserApi {
	async function call(method: string, url: string, body?: unknown): Promise<Response> {
		const write = method !== 'GET';
		const response = await fetcher(url, {
			method,
			credentials: 'same-origin',
			cache: 'no-store',
			headers: write
				? { Accept: 'application/json', 'Content-Type': 'application/json' }
				: { Accept: 'application/json' },
			body: write ? JSON.stringify(body ?? {}) : undefined,
			signal: AbortSignal.timeout(patience)
		}).catch(() => {
			throw Object.assign(new Error(browserError('', 0)), {
				status: 0,
				code: ''
			});
		});
		if (response.ok) return response;
		const refused = await failure(response);
		failed(refused);
		throw refused;
	}
	return {
		get: async <T>(path: string, query?: Query) =>
			(await (await call('GET', address(path, query))).json()) as T,
		send: async <T>(method: 'POST' | 'DELETE', path: string, body?: unknown) =>
			(await (await call(method, address(path), body)).json()) as T,
		media: async (path: string, query?: Query) => {
			const response = await call('GET', address(path, query));
			return {
				bytes: await hostedResponse(response, artifactLimit),
				mediaType: response.headers.get('content-type') ?? ''
			};
		},
		bytes: async (path: string, query?: Query) =>
			new Uint8Array(await (await call('GET', address(path, query))).arrayBuffer())
	};
}
