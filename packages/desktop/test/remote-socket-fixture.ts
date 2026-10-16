import type { RemoteSocket } from '../../remote/src/index';

/** One end of a socket held by a relay in memory: what its client sends, and how to reach it. */
export function socketEnd(onText: (text: string) => void, onClose: () => void) {
	let message: ((text: string) => void) | null = null,
		closed: ((code: number) => void) | null = null;
	const state = { open: true };
	const finish = (code: number) => {
		if (!state.open) return;
		state.open = false;
		onClose();
		closed?.(code);
	};
	const socket: RemoteSocket = {
		opened: Promise.resolve(),
		send: (text) => queueMicrotask(() => (state.open ? onText(text) : undefined)),
		close: (code = 1000) => queueMicrotask(() => finish(code)),
		onMessage: (listener) => (message = listener),
		onClose: (listener) => (closed = listener)
	};
	return {
		socket,
		state,
		deliver: (value: unknown) =>
			queueMicrotask(() => (state.open ? message?.(JSON.stringify(value)) : undefined)),
		text: (text: string) => queueMicrotask(() => (state.open ? message?.(text) : undefined)),
		shut: finish
	};
}
export type SocketEnd = ReturnType<typeof socketEnd>;
