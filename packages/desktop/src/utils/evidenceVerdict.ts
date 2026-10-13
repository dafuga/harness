import type { ExplorerSide } from '../../../reports/src/models/Explorer.types';
import { explorerVerdict } from '../../../reports/src/utils/explorerVerdict';
import type { CatalogEntity, Verification } from '../models/Desktop.types';
import type { EntityEvidenceResult } from '../models/DesktopEvidence.types';
import { evidenceNotice, readingEvidence, type EvidenceStatus } from './evidenceNotice';

/** What of the evidence store says how far the read of an entity has come. */
export interface EvidenceRead {
	status: EvidenceStatus;
	result: EntityEvidenceResult | null;
	error: string;
}
export interface EntityVerdict {
	status: Verification;
	reason: string;
}
type Judged = Pick<CatalogEntity, 'id' | 'kind' | 'verification' | 'verificationNote'>;
const unheld = 'The evidence that was read does not hold this entity, so it is not judged here.';

/** The verdict of the reports explorer for one side, or why that side judges nothing. */
function judged(side: ExplorerSide, entity: Judged): EntityVerdict {
	const unit = side.detail?.registry.units.find((item) => item.id === entity.id);
	if (!side.detail || !unit) return { status: 'unknown', reason: side.gap ?? unheld };
	const verdict = explorerVerdict(unit, side.detail);
	const reason = [verdict.label, verdict.reasons.join(' ')].filter(Boolean).join(': ');
	// Without a record of the commit nothing was verified: that is not known, and not failed.
	if (!side.record) return { status: 'unknown', reason };
	return { status: verdict.passed ? 'verified' : 'failed', reason };
}

/**
 * How an entity stands at the shown commit, for the mark beside its name. Once its evidence was
 * read for exactly that commit, it is the verdict of the reports explorer over the record that
 * judges the commit: proven only by full coverage, and never from the catalog or a part of the
 * states. While it is read, cannot be read or failed to be read, the standing is unknown and
 * says which. Before anything was asked, what the catalog said is repeated.
 */
export function evidenceVerdict(read: EvidenceRead, entity: Judged, commit: string): EntityVerdict {
	if (read.status === 'idle' || read.status === 'planned')
		return { status: entity.verification, reason: entity.verificationNote };
	const notice = evidenceNotice(read.status, read.error, entity.kind);
	if (notice) return { status: 'unknown', reason: notice.text };
	const side = read.result?.evidence.after;
	if (!side || side.commit !== commit) return { status: 'unknown', reason: readingEvidence };
	return judged(side, entity);
}
