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
async function devtools(keepTab = false) {
	const seen: { method: string; params: { expression?: string } }[] = [];
	let tabPresent = true;
	const sockets = new WebSocketServer({ noServer: true });
	server = createServer((_request, response) => {
		const body = JSON.stringify([
			...(tabPresent ? [{ id: 'TAB1', type: 'page', url: 'https://x.com/home' }] : []),
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
				if (method === 'Target.closeTarget' && !keepTab) tabPresent = false;
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

test('closes one valid tab and confirms its disappearance without closing the browser', async () => {
	const { adapter, seen } = await devtools();
	await expect(adapter.closePage('TAB1/other')).rejects.toThrow('Invalid browser tab');
	await expect(adapter.closePage('TAB1')).resolves.toBeUndefined();
	expect(seen).toEqual([{ method: 'Target.closeTarget', params: { targetId: 'TAB1' } }]);
	expect(await adapter.pages()).toEqual([]);
	await expect(adapter.closePage('TAB1')).resolves.toBeUndefined();
	expect(seen).toHaveLength(1);
});

test('a close command cannot clear the private gate while the observed tab remains', async () => {
	const { adapter } = await devtools(true);
	await expect(adapter.closePage('TAB1')).rejects.toThrow('The private browser tab is still open.');
	expect(await adapter.pages()).toHaveLength(1);
});
