import type { RuntimeResponse } from '../../core/execution-runtimes/runtimeTypes';

export interface RuntimeReply {
	status: number;
	value: RuntimeResponse;
}
