import type { RemoteSocket } from '../../src/services/DeviceConnectionService';

/** Both ends of one WebSocket in memory: what the device sent, and a way to answer it. */
export function memorySocket() {
	let message: ((text: string) => void) | null = null,
		closed: ((code: number) => void) | null = null,
		peer: ((text: string) => void) | null = null;
	const fromDevice: string[] = [],
		closes: number[] = [];
	const socket: RemoteSocket = {
		opened: Promise.resolve(),
		send: (text) => {
			fromDevice.push(text);
			peer?.(text);
		},
		close: (code = 1000) => {
			closes.push(code);
		},
		onMessage: (listener) => {
			message = listener;
		},
		onClose: (listener) => {
			closed = listener;
		}
	};
	return {
		socket,
		fromDevice,
		closes,
		toDevice: (text: string) => message?.(text),
		drop: (code: number) => closed?.(code),
		onDevice: (listener: (text: string) => void) => {
			peer = listener;
		}
	};
}
