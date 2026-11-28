// @harness-uid u_b6xmtv5qid
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { MacDeviceApprovalError } from './MacDeviceApprovalError';

export class MacDeviceApprovalPipe {
	private child;
	private lines;
	private closed = false;
	constructor(binary: string) {
		this.child = spawn(binary, [], { env: {}, stdio: ['pipe', 'pipe', 'ignore'] });
		this.lines = createInterface({ input: this.child.stdout })[Symbol.asyncIterator]();
		this.child.on('error', () => this.close());
		this.child.stdin.on('error', () => this.close());
		this.child.once('exit', () => this.close());
	}

	async request(input: object): Promise<unknown> {
		if (this.closed) throw new MacDeviceApprovalError('offline');
		const timer = new AbortController();
		try {
			this.child.stdin.write(JSON.stringify(input) + '\n');
			const reply = await Promise.race([
				this.lines.next(),
				delay(120_000, undefined, { signal: timer.signal, ref: false })
			]);
			if (!reply || reply.done || reply.value.length > 16384)
				throw new MacDeviceApprovalError('offline');
			return JSON.parse(reply.value);
		} catch {
			this.close();
			throw new MacDeviceApprovalError('offline');
		} finally {
			timer.abort();
		}
	}

	close(): void {
		if (this.closed) return;
		this.closed = true;
		this.child.stdin.destroy();
		this.child.kill();
	}
}
