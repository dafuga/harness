import type { RuntimeResponse } from '../../src/core/runtimeTypes';

export interface KernelVector {
	name: string;
	/** A structured request, sent through every runtime. */
	request?: unknown;
	/** Raw request text, for transports that receive bytes. */
	text?: string;
	response: RuntimeResponse;
}
