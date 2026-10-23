import type { RuntimeOptions } from '../../core/execution-runtimes/runtimeTypes';
import type { Environment } from '../../utils/execution-runtimes/kernelArtifacts';

export interface RuntimeServiceOptions extends RuntimeOptions {
	env?: Environment;
}
