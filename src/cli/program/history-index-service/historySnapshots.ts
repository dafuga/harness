import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Built, CompactRevision } from './HistoryIndexService.types';
import type {
	BuiltRevision,
	RevisionDetail
} from '../../../services/explorer-ui/revision-detail-service/RevisionDetailService';
import type { CatalogSnapshot } from '../../../services/git-source-history/CatalogWriteService';
import type { BudgetEvent } from '../../../core/verification-evidence/budgetTypes';
import { stableJson } from '../../../utils/development-tooling/stableJson';
import type { RecordedDetail } from '../../../services/projects-sessions/project-activity-service/ProjectActivityService.types';

/** Only summary facts stay live; the complete, revision-specific snapshot is already on disk. */
export function compactRevision(
	result: BuiltRevision,
	events: Map<string, BudgetEvent>
): CompactRevision {
	const { commit, records, sourceImpact, explanations, regressions, registry } = result.detail;
	return {
		status: result.status,
		sound: result.sound,
		ledger: result.ledger.map((event) => {
			const key = stableJson(event);
			const known = events.get(key) ?? event;
			events.set(key, known);
			return known;
		}),
		detail: {
			commit,
			records,
			sourceImpact,
			explanations,
			regressions,
			registry: {
				available: registry.available,
				units: registry.units.map(({ id, version }) => ({ id, version }))
			}
		}
	};
}

/** Catalog insertion consumes each immutable file once, without retaining all registries. */
export function* storedSnapshots(out: string, built: Built): Generator<CatalogSnapshot> {
	for (const { revision } of built) {
		const { registry } = readDetail(out, revision.commit);
		yield { commit: revision.commit, registry };
	}
}

/** Activity uses summary facts and the newest owners, not every historical implementation. */
export function activityDetails(out: string, built: Built): ReadonlyMap<string, RecordedDetail> {
	const details = new Map<string, RecordedDetail>(
		built.map(({ revision, result }) => [
			revision.commit,
			{
				explanations: result.detail.explanations,
				sourceImpact: result.detail.sourceImpact
			}
		])
	);
	const newest = built[0]?.revision.commit;
	if (newest) {
		const { registry } = readDetail(out, newest);
		details.set(newest, {
			...details.get(newest)!,
			registry: { units: registry.units.map(({ id, owns }) => ({ id, owns })) }
		});
	}
	return details;
}
function readDetail(out: string, commit: string): RevisionDetail {
	return JSON.parse(readFileSync(join(out, `revisions/${commit}.json`), 'utf8'));
}
