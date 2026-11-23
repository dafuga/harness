// @harness-uid u_w7u5py3ol5
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { NativeSignInError } from './NativeSignInError';

const host = '127.0.0.1';
const path = '/harness-account';
const finished = '/return-to-harness';

function callbackTarget(request: IncomingMessage, port: number): URL | null {
	const address = `${host}:${port}`;
	const origin = `http://${address}`;
	const target = request.url;
	if (request.method !== 'GET' || request.headers.host !== address || !target?.startsWith('/'))
		return null;
	if (!URL.canParse(target, origin)) return null;
	const url = new URL(target, origin);
	return url.origin === origin ? url : null;
}

function callbackCode(url: URL, state: string): string | null {
	if (!state || url.pathname !== path || url.searchParams.get('state') !== state) return null;
	const code = url.searchParams.get('code');
	return code && /^[A-Za-z0-9_-]{43}$/.test(code) && [...url.searchParams].length === 2
		? code
		: null;
}

/** One ephemeral listener, restricted to the current handoff at a numeric loopback address. */
export class GoogleBrowserCallbackService {
	private readonly server: Server = createServer((request, response) =>
		this.receive(request, response)
	);
	private state = '';
	private received?: string;
	private timer?: ReturnType<typeof setTimeout>;
	private port = 0;

	async listen(): Promise<number> {
		await new Promise<void>((resolve, reject) => {
			this.server.once('error', reject);
			this.server.listen(0, host, () => {
				this.server.removeListener('error', reject);
				resolve();
			});
		});
		const address = this.server.address();
		if (!address || typeof address === 'string')
			throw new NativeSignInError('Sign-in callback unavailable.');
		this.port = address.port;
		this.timer = setTimeout(() => this.close(), 5 * 60 * 1000);
		this.timer.unref();
		this.server.unref();
		return this.port;
	}

	expect(state: string) {
		this.state = state;
	}

	take(): string | undefined {
		const received = this.received;
		this.received = undefined;
		return received;
	}

	close() {
		clearTimeout(this.timer);
		this.server.close();
		this.received = undefined;
	}

	private receive(request: IncomingMessage, response: ServerResponse): void {
		response.setHeader('Cache-Control', 'no-store');
		response.setHeader('Referrer-Policy', 'no-referrer');
		response.setHeader('X-Content-Type-Options', 'nosniff');
		response.setHeader('Content-Type', 'text/plain; charset=utf-8');
		const url = callbackTarget(request, this.port);
		if (!url) return this.refuse(response);
		if (url.pathname === finished && !url.search) {
			response.end('Return to Harness to finish signing in.');
			if (!this.state) this.server.close();
			return;
		}
		const code = callbackCode(url, this.state);
		if (!code) return this.refuse(response);
		this.state = '';
		this.received = code;
		response.writeHead(303, { Location: finished }).end();
	}

	private refuse(response: ServerResponse): void {
		response.writeHead(400).end('This Harness sign-in could not be returned to the app.');
	}
}
