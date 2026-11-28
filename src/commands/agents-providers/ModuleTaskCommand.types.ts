// @harness-uid u_gop636dbcf

export { TaskWorkerInterruptedError } from './TaskWorkerInterruptedError';

export interface WorkerFlags {
	worker: string;
	tracker?: string;
	modules?: string;
	once?: boolean;
	watch?: boolean;
	allowTaskChecks?: boolean;
	json?: boolean;
}
