import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/** One control operation: `METHOD /path` → what it answers. */
export type FixtureAction = (body: Record<string, unknown>) => unknown;
const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

function reply(response: ServerResponse, status: number, value: unknown): void {
	response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
	response.end(JSON.stringify(value));
}
/** From this machine, addressed by a loopback name, and not sent by a page. */
function local(request: IncomingMessage, port: number): boolean {
	const host = request.headers.host ?? '',
		peer = request.socket.remoteAddress ?? '',
		named = host === `127.0.0.1:${port}` || host === `localhost:${port}`;
	return loopback.includes(peer) && named && request.headers.origin === undefined;
}
async function bodyOf(request: IncomingMessage): Promise<Record<string, unknown>> {
	let text = '';
	for await (const chunk of request) {
		text += String(chunk);
		if (text.length > 4096) throw new Error('The request is too large.');
	}
	const value: unknown = text ? JSON.parse(text) : {};
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
async function answer(
	request: IncomingMessage,
	response: ServerResponse,
	control: { port: number; actions: Record<string, FixtureAction> }
): Promise<void> {
	const name = `${request.method} ${request.url}`,
		action = Object.hasOwn(control.actions, name) ? control.actions[name] : null;
	if (!local(request, control.port)) return reply(response, 403, { error: 'forbidden' });
	if (!action) return reply(response, 404, { error: 'not-found' });
	try {
		reply(response, 200, await action(await bodyOf(request)));
	} catch (error) {
		reply(response, 409, { error: error instanceof Error ? error.message : 'failed' });
	}
}

/**
 * TEST ONLY. The control of the remote fixture for the person who runs it: an HTTP server on the
 * loopback address that refuses any caller that is not on this machine or that is a web page.
 */
export async function remoteFixtureControl(port: number, actions: Record<string, FixtureAction>) {
	const control = { port, actions },
		server = createServer((request, response) => void answer(request, response, control));
	await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
	control.port = (server.address() as AddressInfo).port;
	return {
		origin: `http://127.0.0.1:${control.port}`,
		close: () => {
			server.closeAllConnections();
			return new Promise<void>((resolve) => server.close(() => resolve()));
		}
	};
}
