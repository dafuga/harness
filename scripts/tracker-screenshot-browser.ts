// @harness-uid u_auvse3vf4t
import type { ScreenshotBrowser, ScreenshotBrowserReply } from './tracker-screenshot-browser.types';

class ScreenshotBrowserError extends Error {
	override readonly name = 'ScreenshotBrowserError';
}

const chrome = 'http://127.0.0.1:9333';
const timeoutMs = 8000;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Create a task-owned tab with a pixels-and-input-only interface. */
export async function openScreenshotBrowser(origin: string): Promise<ScreenshotBrowser> {
	const url = publicOrigin(origin);
	const id = await createTab();
	const closeTab = () => closeOwnedTab(id);
	let socket: WebSocket | undefined;
	try {
		socket = new WebSocket(`ws://127.0.0.1:9333/devtools/page/${id}`);
		await openedSocket(socket);
		const send = screenshotCommands(socket);
		await send('Emulation.setDeviceMetricsOverride', {
			width: 0,
			height: 0,
			deviceScaleFactor: 1,
			mobile: false
		});
		const result = await send('Page.navigate', { url });
		if (result?.errorText) throw new ScreenshotBrowserError('Navigation failed.');
		return screenshotBrowser(send, closeTab, socket);
	} catch {
		socket?.close();
		await closeTab();
		throw new ScreenshotBrowserError('Could not prepare the screenshot-only tab.');
	}
}

function publicOrigin(value: string): string {
	const url = URL.parse(value);
	const allowedScheme =
		url?.protocol === 'https:' || (url?.protocol === 'http:' && url.hostname === '127.0.0.1');
	if (!url || !allowedScheme || ![url.origin, `${url.origin}/`].includes(value))
		throw new ScreenshotBrowserError('Use a public HTTPS origin or a local HTTP test fixture.');
	return url.href;
}

async function createTab(): Promise<string> {
	try {
		const reply = await fetch(`${chrome}/json/new?about:blank`, {
			method: 'PUT',
			redirect: 'error',
			signal: AbortSignal.timeout(timeoutMs)
		});
		if (!reply.ok) throw new ScreenshotBrowserError();
		const { id } = (await reply.json()) as { id?: string };
		if (typeof id !== 'string' || !/^[a-f0-9]{32}$/i.test(id)) throw new ScreenshotBrowserError();
		return id;
	} catch {
		throw new ScreenshotBrowserError('The dedicated automation Chrome could not open a tab.');
	}
}

async function closeOwnedTab(id: string): Promise<void> {
	try {
		const response = await fetch(`${chrome}/json/close/${id}`, {
			redirect: 'error',
			signal: AbortSignal.timeout(timeoutMs)
		});
		if (!response.ok && response.status !== 404) throw new ScreenshotBrowserError();
	} catch {
		throw new ScreenshotBrowserError('Could not confirm that the screenshot-only tab closed.');
	}
}

function openedSocket(socket: WebSocket): Promise<void> {
	return new Promise((resolve, reject) => {
		const answered = new AbortController();
		const timer = setTimeout(fail, timeoutMs);
		function fail() {
			answered.abort();
			clearTimeout(timer);
			reject(new ScreenshotBrowserError('The dedicated Chrome page socket did not open.'));
		}
		socket.addEventListener(
			'open',
			() => {
				answered.abort();
				clearTimeout(timer);
				resolve();
			},
			{ signal: answered.signal }
		);
		socket.addEventListener('error', fail, { signal: answered.signal });
		socket.addEventListener('close', fail, { signal: answered.signal });
	});
}

function screenshotCommands(socket: WebSocket) {
	let sequence = 0;
	return function send(
		method:
			| 'Page.navigate'
			| 'Emulation.setDeviceMetricsOverride'
			| 'Page.captureScreenshot'
			| 'Input.dispatchMouseEvent'
			| 'Input.insertText',
		params: object
	): Promise<ScreenshotBrowserReply['result']> {
		const id = ++sequence;
		return new Promise((resolve, reject) => {
			const answered = new AbortController();
			const timer = setTimeout(fail, timeoutMs);
			function fail() {
				answered.abort();
				clearTimeout(timer);
				reject(new ScreenshotBrowserError(`Chrome could not complete ${method}.`));
			}
			const options = { signal: answered.signal };
			socket.addEventListener('close', fail, options);
			socket.addEventListener('error', fail, options);
			socket.addEventListener(
				'message',
				(event) => {
					const reply = parseReply(event.data);
					if (!reply || reply.id !== id) return;
					if (reply.error) return fail();
					answered.abort();
					clearTimeout(timer);
					resolve(reply.result);
				},
				options
			);
			try {
				socket.send(JSON.stringify({ id, method, params }));
			} catch {
				fail();
			}
		});
	};
}

function parseReply(data: unknown): ScreenshotBrowserReply | undefined {
	if (typeof data !== 'string') return;
	try {
		const value = JSON.parse(data);
		if (value && typeof value === 'object') return value;
	} catch {
		// Ignore event and malformed payloads without exposing their contents.
	}
}

function screenshotBrowser(
	send: ReturnType<typeof screenshotCommands>,
	closeTab: () => Promise<void>,
	socket: WebSocket
): ScreenshotBrowser {
	let queue: Promise<unknown> = Promise.resolve();
	let closing = false;
	let closed: Promise<void> | undefined;
	function run<Value>(action: () => Promise<Value>): Promise<Value> {
		if (closing)
			return Promise.reject(new ScreenshotBrowserError('The screenshot-only tab is closing.'));
		const result = queue.then(action);
		queue = result.catch(() => {});
		return result;
	}
	return {
		screenshot: () => run(() => capturePng(send)),
		click: (x, y) =>
			run(async () => {
				if (![x, y].every((coordinate) => Number.isSafeInteger(coordinate) && coordinate >= 0))
					throw new ScreenshotBrowserError('Click coordinates must be nonnegative integers.');
				const point = { x, y, button: 'left', clickCount: 1 };
				await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point });
				await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point });
			}),
		type: (text) =>
			run(async () => {
				await send('Input.insertText', { text });
			}),
		close() {
			closing = true;
			return (closed ??= queue
				.then(async () => {
					socket.close();
					await closeTab();
				})
				.catch((error: unknown) => {
					closed = undefined;
					throw error;
				}));
		}
	};
}

async function capturePng(send: ReturnType<typeof screenshotCommands>): Promise<Buffer> {
	const capture = () =>
		send('Page.captureScreenshot', {
			format: 'png',
			fromSurface: true,
			captureBeyondViewport: false
		});
	// Chrome can reject a capture before the first compositor frame of a new document.
	const result = await capture().catch(async () => {
		await new Promise((resolve) => setTimeout(resolve, 150));
		return capture();
	});
	const png = Buffer.from(typeof result?.data === 'string' ? result.data : '', 'base64');
	if (!png.subarray(0, pngSignature.length).equals(pngSignature))
		throw new ScreenshotBrowserError('Chrome did not return a PNG screenshot.');
	return png;
}
