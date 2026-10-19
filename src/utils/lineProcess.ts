import { runtimeFailure, type RuntimeResponse } from "../core/runtimeTypes";

export type ProcessReply = { text: string } | { failure: RuntimeResponse };

export interface LineProcess {
	/** Sends one line and resolves with the next line the process prints. */
	exchange(line: string, timeoutMs: number): Promise<ProcessReply>;
	close(): void;
}

export function unavailable(command: string, error: Error): RuntimeResponse {
	return runtimeFailure('runtime-unavailable', `cannot start ${command}: ${error.message}`);
}

export function exited(code: number | null, stderr: string): RuntimeResponse {
	const detail = stderr.trim().slice(-200);
	const message = `process exited with code ${code ?? 'unknown'}${detail ? `: ${detail}` : ''}`;
	return runtimeFailure('runtime-failed', message);
}

export { lineProcess } from '../adapters/process-runtime-adapter/lineProcess';
