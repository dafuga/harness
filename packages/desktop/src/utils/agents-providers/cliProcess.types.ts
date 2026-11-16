// @harness-uid u_b7hlwurone
import type { ResourceContext } from '../../../../../src/core/execution-runtimes/resourceTypes';

export interface ProcessOptions {
	resources?: ResourceContext;
	cwd?: string;
	input?: string;
	signal?: AbortSignal;
	onLine?: (line: string) => void;
	timeoutMs?: number;
	maxBytes?: number;
}
