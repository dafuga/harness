import { side } from '../recordedProjection';
import type { ExplorerEvidence } from '../../../../reports/src/models/Explorer.types';

/**
 * The evidence of one entity with only what that entity needs. Each side keeps its captures and
 * coverage as they were found, and of its revision and records what judges this entity: its own
 * unit, the scenarios that cover it with the states that show it, every test, and its own
 * failures, measurements, limits, impact and reasons. Other units, the graph, the files a
 * commit changed and the results of other scenarios are left out. The evidence that is given is
 * not altered, and the projection still derives the same evidence and the same verdict.
 */
export function recordedProjection(evidence: ExplorerEvidence, entityId: string): ExplorerEvidence {
	return {
		...evidence,
		after: side(evidence.after, entityId),
		before: evidence.before && side(evidence.before, entityId)
	};
}
