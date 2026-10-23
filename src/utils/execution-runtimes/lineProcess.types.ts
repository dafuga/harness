import type { RuntimeResponse } from '../../core/execution-runtimes/runtimeTypes';

export type ProcessReply = { text: string } | { failure: RuntimeResponse };

export interface LineProcess {
	/** Sends one line and resolves with the next line the process prints. */
	exchange(line: string, timeoutMs: number): Promise<ProcessReply>;
	close(): void;
}
