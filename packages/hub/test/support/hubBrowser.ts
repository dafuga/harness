import type { HubAuth } from '../../src/models/HubAuth.types';
import { ORIGIN } from './authFixture';

type Headers = Record<string, string>;

/** A browser as the hub sees it: a cookie jar, an Origin on POST, and a record of every URL. */
export class HubBrowser {
	readonly cookies = new Map<string, string>();
	readonly setCookies: string[] = [];
	readonly urls: string[] = [];

	constructor(
		private readonly auth: HubAuth,
		private readonly origin = ORIGIN
	) {}

	get(path: string, headers: Headers = {}): Promise<Response> {
		return this.send(this.request(path, { headers }));
	}

	/** Pass `{ origin: '' }` to send no Origin header at all. */
	post(path: string, body: unknown = {}, headers: Headers = {}): Promise<Response> {
		const sent = { origin: this.origin, 'content-type': 'application/json', ...headers };
		return this.send(
			this.request(path, { method: 'POST', body: JSON.stringify(body), headers: sent })
		);
	}

	/** A request carrying this browser's cookies, for calling `auth.actor` directly. */
	request(path: string, init: { method?: string; body?: string; headers?: Headers } = {}): Request {
		const headers = new Headers();
		for (const [name, value] of Object.entries(init.headers ?? {})) {
			if (value) headers.set(name, value);
		}
		const jar = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
		if (jar) headers.set('cookie', jar);
		return new Request(`${ORIGIN}${path}`, { method: init.method, body: init.body, headers });
	}

	private async send(request: Request): Promise<Response> {
		this.urls.push(request.url);
		const response = await this.auth.handle(request);
		if (!response) throw new Error(`Hub auth did not answer ${request.url}`);
		for (const cookie of response.headers.getSetCookie()) this.keep(cookie);
		return response;
	}

	private keep(cookie: string): void {
		this.setCookies.push(cookie);
		const pair = cookie.split(';')[0];
		const name = pair.slice(0, pair.indexOf('='));
		const value = pair.slice(name.length + 1);
		if (value && !cookie.includes('Max-Age=0')) this.cookies.set(name, value);
		else this.cookies.delete(name);
	}
}

/** The desktop app's main process: no cookies, no Origin, optionally a bearer credential. */
export function nativeRequest(path: string, body?: unknown, bearer?: string): Request {
	const headers = new Headers({ 'content-type': 'application/json' });
	if (bearer) headers.set('authorization', `Bearer ${bearer}`);
	const init = body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) };
	return new Request(`${ORIGIN}${path}`, { ...init, headers });
}
