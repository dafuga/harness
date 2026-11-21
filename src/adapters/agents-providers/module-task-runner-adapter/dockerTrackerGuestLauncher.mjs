// @harness-uid u_rw64iex44n
/* global readFrames, writeFrame, readFramePayload, writeFramePayload */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import process from 'node:process';

// readFrames, writeFrame, readFramePayload and writeFramePayload are prepended by the host.
async function guestMain([client, itemId, runId, executable, ...argv]) {
	const frames = readFrames(process.stdin);
	const prompt = await readFramePayload(frames);
	const directory = mkdtempSync('/tmp/harness-tracker-');
	const path = join(directory, 'relay.sock');
	const sockets = new Set();
	let busy = false;
	const server = createServer((socket) => {
		sockets.add(socket);
		socket.once('close', () => sockets.delete(socket));
		socket.on('error', () => {});
		if (busy) return socket.destroy();
		busy = true;
		void serveTrackerSocket(socket, frames).finally(() => {
			busy = false;
		});
	});
	try {
		writeFileSync(join(directory, 'tracker'), '#!/usr/bin/env bun\n' + client, { mode: 0o700 });
		server.listen(path);
		await once(server, 'listening');
		return await runGuestProvider({ executable, argv, prompt }, { directory, path, itemId, runId });
	} finally {
		for (const socket of sockets) socket.destroy();
		server.close();
		process.stdin.destroy();
		rmSync(directory, { recursive: true, force: true });
	}
}

async function serveTrackerSocket(socket, frames) {
	socket.setTimeout(20_000, () => socket.destroy());
	try {
		const requests = readFrames(socket);
		const { value, done } = await requests.next();
		if (!done) {
			await writeFrame(process.stderr, value);
			const response = await readFramePayload(frames);
			if (!socket.destroyed) await writeFramePayload(socket, response);
		}
	} catch {
		// The shim reports an interrupted request when the socket closes early.
	} finally {
		socket.end(() => socket.destroy());
	}
}

async function runGuestProvider({ executable, argv, prompt }, { directory, path, itemId, runId }) {
	const child = spawn(executable, argv, {
		stdio: ['pipe', 'inherit', 'ignore'],
		env: {
			...process.env,
			PATH: `${directory}:${process.env.PATH ?? '/usr/bin:/bin'}`,
			HARNESS_TRACKER_GUEST_SOCKET: path,
			TRACKER_ITEM_ID: itemId,
			TRACKER_RUN_ID: runId
		}
	});
	child.stdin.on('error', () => {});
	child.stdin.end(prompt);
	const [code] = await once(child, 'close');
	return typeof code === 'number' ? code : 1;
}

try {
	process.exitCode = await guestMain(process.argv.slice(1));
} catch {
	process.exitCode = 125;
}
