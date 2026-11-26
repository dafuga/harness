// @harness-uid u_ouedfqze7m
/** A health probe whose response is not OK, or whose protocol is not harness-worker-v1. */
export class WorkerNotReadyError extends Error {
	override name = 'WorkerNotReadyError';
}
