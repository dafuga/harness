import type { DoorbellOptions, DoorbellSocket } from './realtime.types';

/**
 * One socket to the account object, reopened with backoff for as long as it is wanted. A notice
 * names a topic and carries nothing else. Notices are not replayed: every connect reports
 * `resync`, and the listener reads current state, so a gap cannot hide a change.
 */
export function followDoorbell(options: DoorbellOptions) {
	const { pingMs = 15_000, retryMs = 500, maxRetryMs = 10_000 } = options;
	let socket: DoorbellSocket | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let beat: ReturnType<typeof setInterval> | undefined;
	let failures = 0;
	let heard = true;
	let attempt = 0;
	let stopped = false;

	function release() {
		clearInterval(beat);
		clearTimeout(timer);
		if (!socket) return;
		socket.onopen = socket.onmessage = socket.onclose = null;
		socket.onerror = () => undefined;
		socket.close();
		socket = null;
	}

	/** Also the path of a half-open socket, whose close event may never come. */
	function drop() {
		release();
		if (stopped) return;
		options.onState('reconnecting');
		const delay = Math.min(retryMs * 2 ** failures++, maxRetryMs);
		timer = setTimeout(() => void connect(), delay);
	}

	function heartbeat() {
		if (!heard) return drop();
		heard = false;
		socket?.send('ping');
	}

	function opened() {
		failures = 0;
		heard = true;
		beat = setInterval(heartbeat, pingMs);
		options.onState('live');
		options.onChange('resync');
	}

	function received(data: unknown) {
		heard = true;
		const topic = changedTopic(String(data));
		if (topic) options.onChange(topic);
	}

	async function connect() {
		release();
		const mine = ++attempt;
		try {
			const next = await options.open();
			if (stopped || mine !== attempt) return next.close();
			socket = next;
			next.onopen = opened;
			next.onmessage = (event) => received(event.data);
			next.onclose = next.onerror = drop;
		} catch {
			if (mine === attempt) drop();
		}
	}

	void connect();
	return {
		/** Skips the backoff, for a page that just became visible or a network that returned. */
		retryNow() {
			if (stopped || failures === 0) return;
			failures = 0;
			void connect();
		},
		stop() {
			stopped = true;
			release();
		}
	};
}

function changedTopic(text: string): string | null {
	try {
		const value = JSON.parse(text) as { t?: unknown; topic?: unknown };
		return value.t === 'changed' && typeof value.topic === 'string' ? value.topic : null;
	} catch {
		return null;
	}
}
