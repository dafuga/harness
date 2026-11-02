// @harness-uid u_fsrk36z44c
import type { RuntimeResponse } from '../../core/execution-runtimes/runtimeTypes';

export interface RuntimeReply {
	status: number;
	value: RuntimeResponse;
}
