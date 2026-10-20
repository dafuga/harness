import { impactKernel } from '../../utils/impact-kernel/impactKernel';
import { notPortable } from '../../utils/portableJson';

/** The same kernel over JSON text, as byte transports see it. */
export function impactKernelText(text: string): string {
	let request: unknown;
	try {
		request = JSON.parse(text);
	} catch {
		return JSON.stringify(notPortable);
	}
	return JSON.stringify(impactKernel(request));
}
