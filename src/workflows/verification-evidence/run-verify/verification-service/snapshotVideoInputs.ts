// @harness-uid u_x7kddegtw2
import type { PendingVideoFlags } from '../../../../utils/verification-evidence/scenarioCoverage.types';
import { snapshotVideoFlags } from './snapshotVideoFlags';
import type { ScenarioManifest } from '../../../../core/development-tooling/unitTypes';
import type { VideoSlot } from '../../../../services/verification-evidence/VideoEvidenceService.types';
import { VideoEvidenceService } from '../../../../services/verification-evidence/VideoEvidenceService';

/** Hash source before setup or tests can write outputs; never hash the mutable requesting tree. */
export async function snapshotVideoInputs(
	root: string,
	scenarios: ScenarioManifest[],
	evidenceRoot: string = root
): Promise<{
	videoSlots: Record<string, VideoSlot[]>;
	pendingVideoFlags: Record<string, PendingVideoFlags>;
	failures: string[];
}> {
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
	let pendingVideoFlags: Record<string, PendingVideoFlags> = {};
	try {
		pendingVideoFlags = await snapshotVideoFlags(evidenceRoot, scenarios);
	} catch (error) {
		failures.push(
			`Video reviewer flags cannot be proved: ${error instanceof Error ? error.message : 'invalid retained feedback'}`
		);
	}
	return { videoSlots, pendingVideoFlags, failures };
}
