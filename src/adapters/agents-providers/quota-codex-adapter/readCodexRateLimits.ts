// @harness-uid u_jcivcx7cf2
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import { z } from 'zod';
import { quotaProcessEnvironment } from '../quotaProcessEnvironment';

const response = z.object({ id: z.number(), result: z.unknown() });
const initialize = {
	id: 1,
	method: 'initialize',
	params: { clientInfo: { name: 'harness-subscription-quota', version: '1' } }
};

/** One short-lived stdio connection. The client never asks for tokens or starts a turn. */
export async function readCodexRateLimits(): Promise<unknown> {
	const process = spawn('codex', ['app-server', '--stdio'], {
		cwd: tmpdir(),
		env: quotaProcessEnvironment(),
		stdio: ['pipe', 'pipe', 'ignore']
	});
	const lines = createInterface({ input: process.stdout });
	try {
		return await new Promise<unknown>((resolve) => {
			let bytes = 0;
			const timer = setTimeout(() => finish(null), 8_000);
			function finish(value: unknown) {
				clearTimeout(timer);
				resolve(value);
			}
			function send(...messages: object[]) {
				process.stdin.write(messages.map((message) => JSON.stringify(message) + '\n').join(''));
			}
			process.once('error', () => finish(null));
			process.once('close', () => finish(null));
			process.stdin.on('error', () => finish(null));
			process.stdout.on('data', (chunk: Buffer) => {
				bytes += chunk.length;
				if (bytes > 256 * 1024) finish(null);
			});
			lines.on('line', (line) => {
				const reply = parseReply(line);
				if (reply?.id === 1 && reply.result) {
					send({ method: 'initialized' }, { id: 2, method: 'account/rateLimits/read' });
				}
				if (reply?.id === 2) finish(reply.result ?? null);
			});
			send(initialize);
		});
	} finally {
		lines.close();
		process.stdin.destroy();
		process.stdout.destroy();
		process.kill();
	}
}

function parseReply(line: string) {
	try {
		return response.safeParse(JSON.parse(line)).data;
	} catch {
		return undefined;
	}
}
