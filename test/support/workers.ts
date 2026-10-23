import type { LocalWorker } from './workers.types';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { ownEnvironment } from './cli';

const wrangler = resolve(import.meta.dirname, '../../node_modules/.bin/wrangler');

/** A loopback port that was free a moment ago. */
export function freePort(): Promise<number> {
	return new Promise((done, fail) => {
		const server = createServer();
		server.once('error', fail);
		server.listen(0, '127.0.0.1', () => {
			const { port } = server.address() as { port: number };
			server.close(() => done(port));
		});
	});
}

async function answers(url: string): Promise<boolean> {
	try {
		await fetch(url, { signal: AbortSignal.timeout(1_000) });
		return true;
	} catch {
		return false;
	}
}

/**
 * Starts Wrangler's local runtime (workerd) on free loopback ports and waits until it answers.
 * Wrangler's own state and settings stay inside `cwd`; nothing is written to the user's home.
 */
export async function startWorker(
	cwd: string,
	command: (ports: { port: number; inspector: number }) => string[]
): Promise<LocalWorker> {
	const ports = { port: await freePort(), inspector: await freePort() };
	const settings = {
		WRANGLER_SEND_METRICS: 'false',
		CI: '1',
		XDG_CONFIG_HOME: join(cwd, '.config')
	};
	const child = spawn(wrangler, command(ports), {
		cwd,
		detached: true,
		stdio: ['ignore', 'pipe', 'pipe'],
		env: { ...ownEnvironment(), ...settings }
	});
	const chunks: Buffer[] = [];
	child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
	child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
	const output = () => Buffer.concat(chunks).toString('utf8');
	const exited = new Promise<void>((done) => child.once('exit', () => done()));
	const stop = async (): Promise<void> => {
		try {
			if (child.pid) process.kill(-child.pid, 'SIGTERM');
		} catch {
			// The process group is already gone.
		}
		await exited;
	};
	const url = `http://127.0.0.1:${ports.port}`;
	for (let attempt = 0; attempt < 120 && child.exitCode === null; attempt += 1) {
		if (await answers(url)) return { url, output, stop };
		await new Promise((later) => setTimeout(later, 500));
	}
	await stop();
	throw new Error(`the local Workers runtime did not start\n${output()}`);
}

export type { LocalWorker } from './workers.types';
