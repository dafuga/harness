import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';

/** One process as the system shows it at this moment. */
export interface ProcessFacts {
	parent: number;
	group: number;
	terminal: string;
	started: string;
	name: string;
}
/** Read-only looks at processes, each made with a tool of the system that is waited for. */
export interface ProcessProbes {
	/** Runs one tool to its end. A tool that fails, is late or is cancelled reads as not ok. */
	ran(file: string, args: string[]): Promise<{ ok: boolean; out: string }>;
	/** Null when the process is not there or cannot be read. */
	facts(pid: number): Promise<ProcessFacts | null>;
	/** The program the process is really running, canonical; null when that cannot be read. */
	executable(pid: number): Promise<string | null>;
}
export interface ProbeLimits {
	/** Ends every tool that is running, and starts no other, once it is aborted. */
	signal?: AbortSignal;
	timeoutMs?: number;
}

/** How long one tool may take before it is ended. It is this process's own child. */
const probeMs = 3000;
/** How many tools may run at a time, over all probes of this process. */
const atOnce = 8;
const waiting: (() => void)[] = [];
let running = 0;

/** A turn among the few tools that may run at a time; the answer gives the turn back. */
async function turn(): Promise<() => void> {
	if (running >= atOnce) await new Promise<void>((next) => waiting.push(next));
	else running += 1;
	return () => {
		const next = waiting.shift();
		if (next) next();
		else running -= 1;
	};
}

async function facts(ran: ProcessProbes['ran'], pid: number): Promise<ProcessFacts | null> {
	const { out } = await ran('ps', ['-p', String(pid), '-o', 'ppid=,pgid=,tty=,lstart=,comm=']);
	const row = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\w+\s+\w+\s+\d+\s+[\d:]+\s+\d+)\s+(.+?)\s*$/;
	const found = row.exec(out.split('\n')[0] ?? '');
	if (!found) return null;
	const [parent, group] = [Number(found[1]), Number(found[2])];
	return { parent, group, terminal: found[3], started: found[4], name: found[5] };
}

/** By the file the system holds open as the program of the process, not by a name it gives. */
async function executable(ran: ProcessProbes['ran'], pid: number): Promise<string | null> {
	const { out } = await ran('lsof', ['-a', '-p', String(pid), '-d', 'txt', '-Fn']);
	const first = out.split('\n').find((line) => line.startsWith('n/'));
	try {
		return first ? realpathSync(first.slice(1)) : null;
	} catch {
		return null;
	}
}

/**
 * The looks the runner takes at processes. Every tool is bounded in time and ended when it is
 * late or when the work it belongs to is over, and only a few run at once.
 */
export function processProbes(limits: ProbeLimits = {}): ProcessProbes {
	const options = {
		maxBuffer: 16_000_000,
		timeout: limits.timeoutMs ?? probeMs,
		killSignal: 'SIGKILL' as const,
		signal: limits.signal
	};
	const ran = async (file: string, args: string[]) => {
		const done = await turn();
		if (limits.signal?.aborted) return (done(), { ok: false, out: '' });
		return new Promise<{ ok: boolean; out: string }>((resolve) => {
			execFile(file, args, options, (error, out) => {
				done();
				resolve({ ok: !error, out: typeof out === 'string' ? out : '' });
			});
		});
	};
	return { ran, facts: (pid) => facts(ran, pid), executable: (pid) => executable(ran, pid) };
}
