// @harness-uid u_g7kdpz7bel
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { trackerIsoTime } from '../../../utils/projects-sessions/normalizeTrackerDue';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import {
	encodeTrackerArtifact,
	trackerArtifactMaxBytes,
	trackerArtifactSchema,
	trackerPlanning,
	trackerPlanningStage,
	trackerStage,
	trackerStages
} from '../../../utils/projects-sessions/trackerPlanning';
import type { TrackerArtifact } from '../../../utils/projects-sessions/trackerPlanning.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { readItemBody } from './trackerLocalItemMutation';

export async function writeTrackerPlanning(
	request: Request,
	target: { id: string; verb: 'stage' | 'artifact'; actor: string | null },
	dependencies: { store: TrackerPersistenceService; items: TrackerItemReadRepository; now: number }
): Promise<TrackerItem> {
	const body = await readItemBody(request, trackerArtifactMaxBytes * 2);
	request.signal.throwIfAborted();
	const next = trackerStage(body.stage);
	const { store, items, now } = dependencies;
	const actor = target.actor ?? store.node;
	const merge = body.merge_links === true;
	if (merge && (target.verb !== 'artifact' || next !== 'build'))
		throw trackerItemError('merge-links is available for build artifacts');
	const replacement =
		target.verb === 'artifact'
			? { [`planning_artifact_${next}`]: encodeTrackerArtifact(body.artifact) }
			: { [`planning_promotion_${next}`]: JSON.stringify({ by: actor, at: trackerIsoTime(now) }) };
	const links = merge ? artifactLinks(body.artifact) : undefined;
	const id = store.commitLocal(() => {
		const item = items.resolve(target.id);
		if (target.verb === 'stage') {
			const current = trackerPlanningStage(item);
			if (current === next) return { result: item.id };
			if (trackerStages.indexOf(next) !== trackerStages.indexOf(current) + 1)
				throw trackerItemError(`cannot promote from ${current} to ${next}`, 409);
		}
		const fields = links
			? {
					planning_artifact_build: mergeArtifactLinks(trackerPlanning(item).artifacts.build, links)
				}
			: replacement;
		return { result: item.id, operation: { itemId: item.id, fields, actor } };
	});
	return items.getStored(id);
}

function artifactLinks(value: unknown) {
	const parsed = trackerArtifactSchema.safeParse(value);
	if (!parsed.success || Object.keys(parsed.data).length !== 1 || !parsed.data.links?.length)
		throw trackerItemError('merge-links requires a build artifact with only links');
	return parsed.data.links;
}

function mergeArtifactLinks(
	document: TrackerArtifact = {},
	links: NonNullable<TrackerArtifact['links']>
) {
	const added = new Map(links.map((link) => [link.label, link]));
	const existing = (document.links ?? []).filter((link) => !added.has(link.label));
	return encodeTrackerArtifact({ ...document, links: [...existing, ...added.values()] });
}
