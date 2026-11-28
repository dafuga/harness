// @harness-uid u_2ojawq54hj
import { CanaryBrowserError } from './CanaryBrowserError';
import type { CdpReply } from './canary.types';

const replyMs = 30_000;

/** Send commands over one tab's DevTools socket. */
export async function cdpConnection(address: string) {
	const socket = new WebSocket(address);
	await new Promise<void>((resolve, reject) => {
		socket.addEventListener('open', () => resolve(), { once: true });
		const fail = () => reject(new CanaryBrowserError('the DevTools socket did not open'));
		socket.addEventListener('error', fail, { once: true });
	});
	let last = 0;
	function send(method: string, params: object = {}): Promise<Record<string, unknown>> {
		const id = ++last;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new CanaryBrowserError(`${method} timed out`)),
				replyMs
			);
			const listen = (event: MessageEvent) => {
				const reply = JSON.parse(String(event.data)) as CdpReply;
				if (reply.id !== id) return;
				clearTimeout(timer);
				socket.removeEventListener('message', listen);
				if (reply.error) reject(new CanaryBrowserError(`${method}: ${reply.error.message}`));
				else resolve(reply.result ?? {});
			};
			socket.addEventListener('message', listen);
			socket.send(JSON.stringify({ id, method, params }));
		});
	}
	return { send, close: () => socket.close() };
}
