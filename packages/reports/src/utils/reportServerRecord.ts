import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** The server a report store started on one port: which process, and since when. */
export interface ServerRecord {
	pid: number;
	port: number;
	/** When the process started, as the system reports it; a reused id has another start. */
	started: string;
	buildId: string;
}

export interface StoppedServer {
	port: number;
	/** True when the recorded process was running and has been ended. */
	stopped: boolean;
	pid?: number;
	reason?: string;
}

/** When one process started, or undefined when no process has this id. Only that id is asked. */
export function processStarted(pid: number): Promise<string | undefined> {
	return new Promise((resolve) => {
		execFile('ps', ['-o', 'lstart=', '-p', String(pid)], (error, out) =>
			resolve(error || !out.trim() ? undefined : out.trim())
		);
	});
}

/**
 * The record a report store keeps of the server it started on a port. It is what lets the
 * store end exactly that server later: a process is signalled only when its id and its start
 * time are the recorded ones, never because it listens on a port.
 */
export function reportServerRecord(root: string, port: number) {
	const file = join(root, 'servers', `${port}.json`);
	return {
		file,
		async read(): Promise<ServerRecord | undefined> {
			const text = await readFile(file, 'utf8').catch(() => undefined);
			return text ? (JSON.parse(text) as ServerRecord) : undefined;
		},
		async write(record: ServerRecord): Promise<void> {
			await mkdir(dirname(file), { recursive: true });
			await writeFile(file, `${JSON.stringify(record, null, 2)}\n`);
		},
		remove: () => rm(file, { force: true })
	};
}

/** Ends the server this store recorded on the port, waits until it is gone, and forgets it. */
export async function stopReportServer(root: string, port: number): Promise<StoppedServer> {
	const record = reportServerRecord(root, port);
	const known = await record.read();
	if (!known) {
		return { port, stopped: false, reason: 'This report store recorded no server on this port.' };
	}
	const same = async () => (await processStarted(known.pid)) === known.started;
	const was = await same();
	if (was) process.kill(known.pid, 'SIGTERM');
	for (let waited = 0; waited < 5000 && (await same()); waited += 100) {
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	if (await same()) process.kill(known.pid, 'SIGKILL');
	await record.remove();
	const ended = was ? {} : { reason: 'The recorded server had already ended.' };
	return { port, stopped: was, pid: known.pid, ...ended };
}
