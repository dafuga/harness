import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

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

export { stopReportServer } from '../services/report-server-service/reportServerRecord';
