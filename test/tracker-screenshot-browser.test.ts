import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { afterEach, expect, test, vi } from 'vitest';
import { openScreenshotBrowser } from '../scripts/tracker-screenshot-browser';

const id = 'FE50B69DB54AC39447F8FEBEA73A5912';
const hidden = 'synthetic-hidden-browser-metadata';
const png =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVp8AAAAASUVORK5CYII=';
const origin = 'https://example.invalid/';
const transportOrigin = '127.0.0.1:9333';

afterEach(() => vi.unstubAllGlobals());

test('returns only pixels and sends only setup, click, and text commands to its own tab', async () => {
	const fixture = await devToolsFixture();
	try {
		const page = await openScreenshotBrowser(origin);
		try {
			expect(Object.keys(page)).toEqual(['screenshot', 'click', 'type', 'close']);
			expect(await page.screenshot()).toEqual(Buffer.from(png, 'base64'));
			await Promise.all([page.click(28, 47), page.type('Café test')]);
		} finally {
			await page.close();
		}
		expect(fixture.requests).toEqual([
			'PUT /json/new?about:blank',
			`WS /devtools/page/${id}`,
			`GET /json/close/${id}`
		]);
		expect(fixture.commands).toEqual([
			{
				method: 'Emulation.setDeviceMetricsOverride',
				params: { width: 0, height: 0, deviceScaleFactor: 1, mobile: false }
			},
			{ method: 'Page.navigate', params: { url: origin } },
			{
				method: 'Page.captureScreenshot',
				params: { format: 'png', fromSurface: true, captureBeyondViewport: false }
			},
			mouseAt('mousePressed'),
			mouseAt('mouseReleased'),
			{ method: 'Input.insertText', params: { text: 'Café test' } }
		]);
	} finally {
		await fixture.stop();
	}
});

test('reports fixed errors for Chrome replies and closes the owned tab on failed setup', async () => {
	const fixture = await devToolsFixture('Page.navigate');
	try {
		await expect(openScreenshotBrowser(origin)).rejects.toThrow(
			/^Could not prepare the screenshot-only tab\.$/
		);
		expect(fixture.requests.at(-1)).toBe(`GET /json/close/${id}`);
	} finally {
		await fixture.stop();
	}
});

test('retries a capture when Chrome has not produced the first frame yet', async () => {
	const fixture = await devToolsFixture('Page.captureScreenshot');
	try {
		const page = await openScreenshotBrowser(origin);
		try {
			expect(await page.screenshot()).toEqual(Buffer.from(png, 'base64'));
			expect(
				fixture.commands.filter(({ method }) => method === 'Page.captureScreenshot')
			).toHaveLength(2);
		} finally {
			await page.close();
		}
	} finally {
		await fixture.stop();
	}
});

test('rejects sensitive or ambiguous navigation inputs without contacting Chrome', async () => {
	const fetchSpy = vi.fn();
	vi.stubGlobal('fetch', fetchSpy);
	for (const url of [
		'https://example.invalid/?session=synthetic',
		'https://example.invalid/#synthetic',
		'https://example.invalid/synthetic',
		'https://synthetic@example.invalid',
		'file:///private/file'
	]) {
		await expect(openScreenshotBrowser(url)).rejects.toThrow(/^Use a public HTTPS origin/);
	}
	expect(fetchSpy).not.toHaveBeenCalled();
});

test('does not pass Chrome errors or typed text through failure messages', async () => {
	const fixture = await devToolsFixture('Input.insertText');
	try {
		const page = await openScreenshotBrowser(origin);
		try {
			await expect(page.click(-1, 7)).rejects.toThrow(/^Click coordinates/);
			await expect(page.type(hidden)).rejects.toThrow(
				/^Chrome could not complete Input\.insertText\.$/
			);
			expect(await page.screenshot()).toEqual(Buffer.from(png, 'base64'));
		} finally {
			await page.close();
		}
	} finally {
		await fixture.stop();
	}
});

function mouseAt(type: string) {
	return {
		method: 'Input.dispatchMouseEvent',
		params: { type, x: 28, y: 47, button: 'left', clickCount: 1 }
	};
}

async function devToolsFixture(failedMethod?: string) {
	const requests: string[] = [];
	const commands: Array<{ method: string; params: object }> = [];
	const server = createServer((request, response) => {
		requests.push(`${request.method} ${request.url}`);
		response.setHeader('Content-Type', 'application/json');
		response.end(JSON.stringify({ id, url: hidden, title: hidden, webSocketDebuggerUrl: hidden }));
	});
	const webSockets = new WebSocketServer({ server });
	webSockets.on('connection', (socket, request) => {
		requests.push(`WS ${request.url}`);
		socket.on('message', (raw) => {
			const { id: requestId, method, params } = JSON.parse(String(raw));
			const fails =
				failedMethod === method && !commands.some((command) => command.method === method);
			commands.push({ method, params });
			socket.send(JSON.stringify({ method: 'Accessibility.nodesUpdated', params: { hidden } }));
			socket.send(
				JSON.stringify({
					id: requestId,
					...(fails
						? { error: { message: hidden } }
						: { result: method === 'Page.captureScreenshot' ? { data: png, hidden } : { hidden } })
				})
			);
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('No fixture port.');
	const redirect = (url: string) => url.replace(transportOrigin, `127.0.0.1:${address.port}`);
	const originalFetch = globalThis.fetch;
	const OriginalSocket = globalThis.WebSocket;
	vi.stubGlobal('fetch', (url: string, options: RequestInit) =>
		originalFetch(redirect(url), options)
	);
	vi.stubGlobal(
		'WebSocket',
		class extends OriginalSocket {
			constructor(url: string) {
				super(redirect(url));
			}
		}
	);
	async function stop() {
		for (const client of webSockets.clients) client.terminate();
		webSockets.close();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
	return { requests, commands, stop };
}
