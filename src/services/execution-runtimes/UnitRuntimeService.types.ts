// @harness-uid u_t7hihkx2oh
import type { RuntimeOptions } from '../../core/execution-runtimes/runtimeTypes';
import type { RuntimeEnvironment } from '../../core/execution-runtimes/runtimeTypes.types';

export interface RuntimeServiceOptions extends RuntimeOptions {
	env?: RuntimeEnvironment;
}
