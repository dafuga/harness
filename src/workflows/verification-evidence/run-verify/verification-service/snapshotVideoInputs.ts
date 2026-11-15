// @harness-uid u_x7kddegtw2
import type { ScenarioManifest } from '../../../../core/development-tooling/unitTypes';
import type { VideoSlot } from '../../../../services/verification-evidence/VideoEvidenceService.types';
import { VideoEvidenceService } from '../../../../services/verification-evidence/VideoEvidenceService';

/** Hash source before setup or tests can write outputs; never hash the mutable requesting tree. */
export function snapshotVideoInputs(
	root: string,
	scenarios: ScenarioManifest[]
): {
	videoSlots: Record<string, VideoSlot[]>;
	failures: string[];
} {
	const videoSlots: Record<string, VideoSlot[]> = {},
		failures: string[] = [];
	const service = new VideoEvidenceService(root);
	for (const scenario of scenarios.filter((scenario) => scenario.video)) {
		try {
			videoSlots[scenario.id] = service.plan(scenario.video!).record;
		} catch (error) {
			failures.push(
				`${scenario.id}: video inputs cannot be proved: ${error instanceof Error ? error.message : 'invalid declaration'}`
			);
		}
	}
	return { videoSlots, failures };
}
