import type { Page } from '@playwright/test';
import { ada, hostedFixture } from '../hosted-fixture';

const session = 'session-browser';
const chained = /\/api\/(?:hub-home|remote)(?:\/|\?|$)/;

/**
 * Sends the built Hub page's Home and linked-computer traffic, requests and socket, to the chain.
 * Only sign-in and the project list around them are answered by the page fixture.
 */
export async function joinInstalledChain(page: Page, origin: string) {
	await hostedFixture(page, { actor: { ...ada, name: 'Daniel' } });
	await page.route(
		(url) => !url.pathname.startsWith('/src/') && chained.test(url.pathname + url.search),
		async (route) => {
			const url = new URL(route.request().url());
			const headers = { ...route.request().headers(), 'x-test-session': session, origin };
			const response = await route.fetch({ url: origin + url.pathname + url.search, headers });
			await route.fulfill({ response });
		}
	);
	await page.routeWebSocket(/\/api\/remote\/hosts\/[^/]+\/connect\//, (socket) => {
		const target = origin.replace('http', 'ws') + new URL(socket.url()).pathname;
		// Node's WebSocket takes the headers a browser would add itself.
		const options = { headers: { 'x-test-session': session, Origin: origin } };
		const upstream = new WebSocket(target, options as unknown as string[]);
		const waiting: string[] = [];
		upstream.onopen = () => waiting.splice(0).forEach((text) => upstream.send(text));
		upstream.onmessage = (event) => socket.send(String(event.data));
		upstream.onclose = () => void socket.close().catch(() => undefined);
		socket.onMessage((message) => {
			if (upstream.readyState === WebSocket.OPEN) upstream.send(String(message));
			else waiting.push(String(message));
		});
		socket.onClose(() => upstream.close());
	});
}
