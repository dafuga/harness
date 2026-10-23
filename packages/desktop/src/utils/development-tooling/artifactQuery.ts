import type { EvidenceSide } from './artifactQuery.types';
import { mediaFile } from '../../../../reports/src/utils/harnessEvidence';
import type { ExplorerCapture } from '../../../../reports/src/models/ExplorerEvidence.types';
import type {
	EntityEvidenceQuery,
	EntityEvidenceResult,
	EvidenceArtifactQuery
} from '../../models/verification-evidence/DesktopEvidence.types';

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
	if (!held) return null;
	const stored = held.captures.filter((item) => item.capture.media !== null);
	const found = stored.find((item) =>
		typeof file === 'string' ? mediaFile(item.capture) === file : item === file
	);
	if (!found) return null;
	const record = found.focused?.record || held.record?.id;
	if (!record) return null;
	const { capture } = found;
	return {
		...scope,
		side,
		recordId: record,
		scenarioId: found.scenario,
		state: found.state,
		evidenceId: capture.evidence,
		viewport: capture.viewport ?? null,
		sha256: capture.sha256,
		notesRevision: result.identity.notesRevision,
		evidenceRevision: result.identity.evidenceRevision
	};
}

export type { EvidenceSide } from './artifactQuery.types';
