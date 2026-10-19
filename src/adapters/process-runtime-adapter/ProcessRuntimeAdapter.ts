import { spawn } from "node:child_process";
import { clearTimeout, setTimeout } from "node:timers";
import { defaultRuntimeTimeoutMs, runtimeTimeout, type RuntimeOptions, type RuntimeRequest, type RuntimeResponse, type UnitRuntime } from "../../core/runtimeTypes";
import { exited, unavailable, type LineProcess, type ProcessReply } from "../../utils/lineProcess";
import { lineProcess } from "./lineProcess";
import { notPortable, portableJson } from "../../utils/portableJson";
import { runtimeDeadline, runtimeResponseText } from "../../utils/runtimeResponse";

export interface ProcessRuntimeConfig extends RuntimeOptions {
	command: string;
	args?: string[];
	/** Keep one process alive and exchange one JSON document per line. */
	persistent?: boolean;
}

/** Runs a native unit as a JSON process: a request on stdin, a response on stdout. */
export class ProcessRuntimeAdapter implements UnitRuntime {
	readonly kind = 'process' as const;
	private readonly timeoutMs: number;
	private readonly session: LineProcess | undefined;
	private queue: Promise<unknown> = Promise.resolve();

	constructor(private readonly config: ProcessRuntimeConfig) {
		this.timeoutMs = config.timeoutMs ?? defaultRuntimeTimeoutMs;
		this.session = config.persistent ? lineProcess(config.command, config.args ?? []) : undefined;
	}

	async invoke(request: RuntimeRequest): Promise<RuntimeResponse> {
		if (!portableJson(request)) return notPortable;
		const deadline = runtimeDeadline(this.timeoutMs);
		const reply = await this.send(JSON.stringify(request));
		return deadline.settle('failure' in reply ? reply.failure : runtimeResponseText(reply.text));
	}

	/** Sends raw request text and returns the raw response text, or a failure envelope. */
	async invokeText(text: string): Promise<string> {
		const reply = await this.send(text);
		return 'failure' in reply ? JSON.stringify(reply.failure) : reply.text;
	}

	close(): Promise<void> {
		this.session?.close();
		return Promise.resolve();
	}

	private send(text: string): Promise<ProcessReply> {
		const session = this.session;
		if (!session) return this.once(text);
		const next = this.queue.then(() => session.exchange(text, this.timeoutMs));
		this.queue = next;
		return next;
	}

	private once(text: string): Promise<ProcessReply> {
		const { command, args = [] } = this.config;
		const child = spawn(command, args, { stdio: 'pipe' });
		const output: Buffer[] = [];
		const errors: Buffer[] = [];
		child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
		child.stdin.on('error', () => undefined);
		child.stdin.end(text);
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				child.kill('SIGKILL');
				resolve({ failure: runtimeTimeout(this.timeoutMs) });
			}, this.timeoutMs);
			child.once('error', (error) => resolve({ failure: unavailable(command, error) }));
			child.once('close', (code) => {
				clearTimeout(timer);
				const stderr = Buffer.concat(errors).toString('utf8');
				const text = Buffer.concat(output).toString('utf8');
				resolve(code === 0 ? { text } : { failure: exited(code, stderr) });
			});
		});
	}
}
