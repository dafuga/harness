import { mediaFile } from '../../../reports/src/utils/harnessEvidence';
import type { ExplorerCapture } from '../../../reports/src/models/ExplorerEvidence.types';
import type {
	EntityEvidenceQuery,
	EntityEvidenceResult,
	EvidenceArtifactQuery
} from '../models/DesktopEvidence.types';

export type EvidenceSide = 'before' | 'after';

/**
 * The request for the bytes of one capture that an evidence answer lists on one of its sides,
 * selected by the listed capture itself or its stored filename. Every field comes from that answer: the
 * record of the side, the scenario and state of the capture, its hash, and the revisions the
 * answer was read at. Null for a capture the side does not list or whose bytes are not stored:
 * nothing is asked for it, and no address is ever made from its name.
 */
export function artifactQuery(
	result: EntityEvidenceResult,
	scope: EntityEvidenceQuery,
	side: EvidenceSide,
	file: string | ExplorerCapture
): EvidenceArtifactQuery | null {
	const held = result.evidence[side];
	const stored = (held?.captures ?? []).filter((item) => item.capture.media !== null);
	const found = stored.find((item) =>
		typeof file === 'string' ? mediaFile(item.capture) === file : item === file
	);
	if (!held?.record || !found) return null;
	const { capture } = found;
	return {
		...scope,
		side,
		recordId: held.record.id,
		scenarioId: found.scenario,
		state: found.state,
		evidenceId: capture.evidence,
		viewport: capture.viewport ?? null,
		sha256: capture.sha256,
		notesRevision: result.identity.notesRevision,
		evidenceRevision: result.identity.evidenceRevision
	};
}
