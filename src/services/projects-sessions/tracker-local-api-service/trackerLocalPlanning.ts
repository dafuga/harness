// @harness-uid u_g7kdpz7bel
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { trackerIsoTime } from '../../../utils/projects-sessions/normalizeTrackerDue';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import {
	encodeTrackerArtifact,
	trackerArtifactMaxBytes,
	trackerPlanningStage,
	trackerStage,
	trackerStages
} from '../../../utils/projects-sessions/trackerPlanning';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { readItemBody } from './trackerLocalItemMutation';

export async function writeTrackerPlanning(
	request: Request,
	target: { id: string; verb: 'stage' | 'artifact'; actor: string | null },
	dependencies: { store: TrackerPersistenceService; items: TrackerItemReadRepository; now: number }
) {
	const body = await readItemBody(request, trackerArtifactMaxBytes * 2);
	request.signal.throwIfAborted();
	const next = trackerStage(body.stage);
	const { store, items, now } = dependencies;
	const actor = target.actor ?? store.node;
	const fields =
		target.verb === 'artifact'
			? { [`planning_artifact_${next}`]: encodeTrackerArtifact(body.artifact) }
			: { [`planning_promotion_${next}`]: JSON.stringify({ by: actor, at: trackerIsoTime(now) }) };
	const id = store.commitLocal(() => {
		const item = items.resolve(target.id);
		if (target.verb === 'stage') {
			const current = trackerPlanningStage(item);
			if (current === next) return { result: item.id };
			if (trackerStages.indexOf(next) !== trackerStages.indexOf(current) + 1)
				throw trackerItemError(`cannot promote from ${current} to ${next}`, 409);
		}
		return { result: item.id, operation: { itemId: item.id, fields, actor } };
	});
	return items.getStored(id);
}
