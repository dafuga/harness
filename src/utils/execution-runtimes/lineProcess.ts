import { runtimeFailure, type RuntimeResponse } from '../../core/execution-runtimes/runtimeTypes';

export function unavailable(command: string, error: Error): RuntimeResponse {
	return runtimeFailure('runtime-unavailable', `cannot start ${command}: ${error.message}`);
}

export function exited(code: number | null, stderr: string): RuntimeResponse {
	const detail = stderr.trim().slice(-200);
	const message = `process exited with code ${code ?? 'unknown'}${detail ? `: ${detail}` : ''}`;
	return runtimeFailure('runtime-failed', message);
}

export { lineProcess } from '../../adapters/execution-runtimes/process-runtime-adapter/lineProcess';

export type { ProcessReply, LineProcess } from './lineProcess.types';
