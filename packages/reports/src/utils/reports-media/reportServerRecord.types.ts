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
