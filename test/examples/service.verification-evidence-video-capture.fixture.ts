import type { VideoCaptureInput } from '../../src/services/verification-evidence/VideoCaptureService.types';

export const commit = 'a'.repeat(40);
export const tree = 'b'.repeat(40);

export function exampleInput(directory: string): VideoCaptureInput {
	return {
		snapshot: 'snapshot-example',
		source: { commit, tree },
		buildId: 'build-example',
		declaration: {},
		evidence: 'evidence-example',
		directory
	};
}
