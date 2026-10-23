import type { ChildProcess } from 'node:child_process';

export interface Child {
	child: ChildProcess;
	/** Resolves once the process is gone: closed with all it wrote read, or never started. */
	closed: Promise<void>;
	/** Why it could not be started, if it could not. */
	failure?: Error;
}
