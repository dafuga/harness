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
