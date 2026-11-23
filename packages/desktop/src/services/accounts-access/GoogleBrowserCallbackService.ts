// @harness-uid u_w7u5py3ol5
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

const host = '127.0.0.1';
const path = '/harness-account';
const finished = '/return-to-harness';

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
		if (!address || typeof address === 'string') throw new Error('Sign-in callback unavailable.');
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
		const origin = `http://${host}:${this.port}`;
		response.setHeader('Cache-Control', 'no-store');
		response.setHeader('Referrer-Policy', 'no-referrer');
		response.setHeader('X-Content-Type-Options', 'nosniff');
		response.setHeader('Content-Type', 'text/plain; charset=utf-8');
		if (
			request.method !== 'GET' ||
			request.headers.host !== `${host}:${this.port}` ||
			!request.url?.startsWith('/') ||
			!URL.canParse(request.url, origin)
		)
			return this.refuse(response);

		const url = new URL(request.url, origin);
		if (url.origin !== origin) return this.refuse(response);
		if (url.pathname === finished && !url.search) {
			response.end('Return to Harness to finish signing in.');
			if (!this.state) this.server.close();
			return;
		}
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		if (
			url.pathname !== path ||
			!this.state ||
			state !== this.state ||
			!code ||
			!/^[A-Za-z0-9_-]{43}$/.test(code) ||
			[...url.searchParams].length !== 2
		)
			return this.refuse(response);
		this.state = '';
		this.received = code;
		response.writeHead(303, { Location: finished }).end();
	}

	private refuse(response: ServerResponse): void {
		response.writeHead(400).end('This Harness sign-in could not be returned to the app.');
	}
}
