// @harness-uid u_lcptkbllua
import type { DoorbellOptions, DoorbellSession } from './realtime.types';

/** Closes the current socket and its timers; its late events are ignored. */
function release(session: DoorbellSession) {
	clearInterval(session.beat);
	clearTimeout(session.timer);
	const { socket } = session;
	if (!socket) return;
	socket.onopen = socket.onmessage = socket.onclose = null;
	socket.onerror = () => undefined;
	socket.close();
	session.socket = null;
}

/** Also the path of a half-open socket, whose close event may never come. */
function drop(session: DoorbellSession) {
	release(session);
	if (session.stopped) return;
	const { retryMs = 500, maxRetryMs = 10_000 } = session.options;
	session.options.onState('reconnecting');
	const delay = Math.min(retryMs * 2 ** session.failures++, maxRetryMs);
	session.timer = setTimeout(() => void connect(session), delay);
}

function heartbeat(session: DoorbellSession) {
	if (!session.heard) return drop(session);
	session.heard = false;
	session.socket?.send('ping');
}

function opened(session: DoorbellSession) {
	session.failures = 0;
	session.heard = true;
	session.beat = setInterval(() => heartbeat(session), session.options.pingMs ?? 15_000);
	session.options.onState('live');
	session.options.onChange('resync');
}

function received(session: DoorbellSession, data: unknown) {
	session.heard = true;
	const topic = changedTopic(String(data));
	if (topic) session.options.onChange(topic);
}

async function connect(session: DoorbellSession) {
	release(session);
	const mine = ++session.attempt;
	try {
		const next = await session.options.open();
		if (session.stopped || mine !== session.attempt) return next.close();
		session.socket = next;
		next.onopen = () => opened(session);
		next.onmessage = (event) => received(session, event.data);
		next.onclose = next.onerror = () => drop(session);
	} catch {
		if (mine === session.attempt) drop(session);
	}
}

/**
 * One socket to the account object, reopened with backoff for as long as it is wanted. A notice
 * names a topic and carries nothing else. Notices are not replayed: every connect reports
 * `resync`, and the listener reads current state, so a gap cannot hide a change.
 */
export function followDoorbell(options: DoorbellOptions) {
	const session: DoorbellSession = {
		options,
		socket: null,
		failures: 0,
		heard: true,
		attempt: 0,
		stopped: false
	};
	void connect(session);
	return {
		/** Skips the backoff, for a page that just became visible or a network that returned. */
		retryNow() {
			if (session.stopped || session.failures === 0) return;
			session.failures = 0;
			void connect(session);
		},
		stop() {
			session.stopped = true;
			release(session);
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
