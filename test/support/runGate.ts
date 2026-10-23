import type { RunGate } from './runGate.types';
import { createServer, type Server, type Socket } from 'node:net';
import { join } from 'node:path';

/** Where the teardown of a browser run finds the gate its observer holds for it. */
export const teardownGate = 'HARNESS_E2E_TEARDOWN_GATE';
/** The longest line either side of a gate sends: the directory of a run, or `release`. */
const longest = 4096;

/**
 * Calls `line` with each whole line a socket sends, however its bytes arrive. A line longer than
 * the bound, whole or unfinished, is never read: the connection is dropped instead.
 */
export function eachLine(socket: Socket, line: (text: string) => void): void {
	let held = '';
	socket.setEncoding('utf8');
	socket.on('data', (chunk: string) => {
		held += chunk;
		let end = held.indexOf('\n');
		while (end >= 0 && end <= longest) {
			line(held.slice(0, end));
			held = held.slice(end + 1);
			end = held.indexOf('\n');
		}
		if (end > longest || held.length > longest) {
			held = '';
			socket.destroy();
		}
	});
}

/** Listens on `path`, or rejects with the reason it cannot, leaving nothing open. */
function listening(server: Server, path: string): Promise<void> {
	return new Promise((ready, refused) => {
		const failed = (error: Error) => {
			server.close();
			refused(error);
		};
		server.once('error', failed);
		server.listen(path, () => {
			server.off('error', failed);
			ready();
		});
	});
}

/**
 * A gate in front of the teardown of one browser run. The run keeps its fixtures until this gate
 * releases them, is closed, or the process that holds it is gone: its socket then closes.
 */
export async function openRunGate(directory: string, name: string): Promise<RunGate> {
	const path = join(directory, `${name}.gate`);
	// A Unix socket path is limited to a little over 100 bytes on macOS.
	if (Buffer.byteLength(path) > 100) throw new Error(`The gate path is too long: ${path}`);
	const connected = new Set<Socket>();
	let released = false;
	// Each run is told once; a run that has gone is not told.
	const tell = (socket: Socket) => {
		if (!socket.writableEnded && !socket.destroyed) socket.end('release\n');
	};
	let arrived: (root: string) => void = () => undefined;
	const reached = new Promise<string>((done) => (arrived = done));
	const server = createServer((socket) => {
		connected.add(socket);
		socket.once('close', () => connected.delete(socket));
		// A run that ended while it waited closes its side; nothing is left to tell it.
		socket.on('error', () => socket.destroy());
		let named = false;
		eachLine(socket, (root) => {
			if (named) return;
			named = true;
			arrived(root);
			if (released) tell(socket);
		});
	});
	await listening(server, path);
	let closed: Promise<void> | null = null;
	return {
		path,
		reached,
		release() {
			released = true;
			for (const socket of connected) tell(socket);
		},
		close() {
			released = true;
			for (const socket of connected) socket.destroy();
			closed ??= new Promise((done) => server.close(() => done()));
			return closed;
		}
	};
}

export type { RunGate } from './runGate.types';
