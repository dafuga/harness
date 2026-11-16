// @harness-uid u_gop636dbcf
export class TaskWorkerInterruptedError extends Error {
	override name = 'TaskWorkerInterruptedError';
}

export interface WorkerFlags {
	worker: string;
	modules?: string;
	once?: boolean;
	watch?: boolean;
	json?: boolean;
}
