// @harness-uid u_hx2sts7clp
import { impactKernel } from '../../../utils/execution-runtimes/impact-kernel/impactKernel';
import type { RuntimeRequest } from '../../../core/execution-runtimes/runtimeTypes';
import { notPortable } from '../../../utils/development-tooling/portableJson';

/** The same kernel over JSON text, as byte transports see it. */
export function impactKernelText(text: string): string {
	let request: unknown;
	try {
		request = JSON.parse(text);
	} catch {
		return JSON.stringify(notPortable);
	}
	return JSON.stringify(impactKernel(request as RuntimeRequest));
}
