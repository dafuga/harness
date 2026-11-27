import { createServer, type Server } from 'node:http';
import { connect, type AddressInfo } from 'node:net';
import { afterEach, expect, test } from 'vitest';
import { WebSocketServer } from 'ws';
import { ContainerCdpAdapter } from '../../../src/adapters/execution-runtimes/ContainerCdpAdapter';

let server: Server | undefined;
afterEach(() => {
	server?.closeAllConnections();
	server?.close();
});

/** A DevTools stand-in speaking real HTTP and WebSocket over TCP sockets used as pipes. */
async function devtools() {
	const seen: { method: string; params: { expression?: string } }[] = [];
	const sockets = new WebSocketServer({ noServer: true });
	server = createServer((_request, response) => {
		const body = JSON.stringify([
			{ id: 'TAB1', type: 'page', url: 'https://x.com/home' },
			{ id: 'W1', type: 'service_worker', url: 'https://x.com/sw.js' }
		]);
		response.writeHead(200, { 'content-length': Buffer.byteLength(body) }).end(body);
	});
	server.on('upgrade', (request, socket, head) =>
		sockets.handleUpgrade(request, socket, head, (client) => {
			client.ping();
			client.on('message', (data) => {
				const { id, method, params } = JSON.parse(data.toString());
				seen.push({ method, params });
				const value = params.expression === 'big' ? 'y'.repeat(200_000) : params.expression;
				const reply = JSON.stringify({ id, result: { result: { value } } });
				client.send(reply.slice(0, 10), { fin: false });
				client.send(reply.slice(10), { fin: true });
			});
		})
	);
	await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
	const port = (server.address() as AddressInfo).port;
	return { seen, adapter: new ContainerCdpAdapter({ pipe: () => connect(port, '127.0.0.1') }) };
}

test('lists only tabs, then evaluates and navigates over the private pipe', async () => {
	const { adapter, seen } = await devtools();
	const pages = await adapter.pages();
	expect(pages).toEqual([{ id: 'TAB1', url: 'https://x.com/home' }]);
	const page = await adapter.attach(pages[0]);
	await expect(page.evaluate('1+1')).resolves.toBe('1+1');
	await expect(page.evaluate('big')).resolves.toHaveLength(200_000);
	await expect(page.evaluate('z'.repeat(70_000))).resolves.toHaveLength(70_000);
	await page.navigate('https://x.com/home');
	expect(new Set(seen.map((call) => call.method))).toEqual(
		new Set(['Runtime.evaluate', 'Page.navigate'])
	);
	page.close();
	await expect(page.evaluate('after')).rejects.toThrow('pipe closed');
	await adapter.quit();
	expect(seen.at(-1)?.method).toBe('Browser.close');
});
