// @harness-uid u_amfxab2pi4
import type { RuntimeOptions } from '../../../core/execution-runtimes/runtimeTypes';

export interface ProcessRuntimeConfig extends RuntimeOptions {
	command: string;
	args?: string[];
	/** Keep one process alive and exchange one JSON document per line. */
	persistent?: boolean;
}
