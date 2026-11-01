import { EvidenceRefsAdapter } from '../../../../packages/desktop/src/lib/development-tooling/desktop-bridge/EvidenceRefsAdapter';
import { PinnedHistoryAdapter } from '../../../../packages/desktop/src/lib/development-tooling/desktop-bridge/PinnedHistoryAdapter';
import { recordedScope } from '../../../../packages/desktop/src/utils/development-tooling/recordedScope';
import { explorerEvidence } from '../../../../packages/reports/src/utils/explorer-ui/explorerEvidence';
import type { UnitShots } from './unitShots.types';

/** The API's pinned verified-proof reader: validates seals, source trees and retained image bytes. */
export async function unitShots(root: string, entity: string, commit: string): Promise<UnitShots> {
	const pins = await new EvidenceRefsAdapter(root).current();
	if (!pins.notesRevision || !pins.evidenceRevision)
		return { captures: [], gap: 'No attached Harness verification evidence at this revision.' };
	const revision = await new PinnedHistoryAdapter(root).revision(pins, commit);
	const unit = revision.detail.registry.units.find((item) => item.id === entity);
	const query = { entityId: entity, branch: 'HEAD', commit, mode: 'current' as const };
	const scope = recordedScope(query, {
		tip: commit,
		kind: unit?.kind,
		revision: revision.facts,
		judged: revision.judged,
		legacy: revision.legacy
	});
	const evidence = explorerEvidence(scope, { head: revision.detail, parent: null }, { id: entity });
	return { captures: evidence.after.captures, gap: evidence.after.gap };
}
