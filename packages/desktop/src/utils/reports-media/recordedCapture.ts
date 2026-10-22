import type { ExplorerEvidence } from '../../../../reports/src/models/Explorer.types';
import type { HarnessCapture } from '../../../../reports/src/models/Harness.types';
import type { EvidenceArtifactQuery } from '../../models/verification-evidence/DesktopEvidence.types';

/** What names one capture of an evidence answer; all of it has to be as the answer lists it. */
export type CaptureBinding = Pick<
	EvidenceArtifactQuery,
	'side' | 'recordId' | 'scenarioId' | 'state' | 'evidenceId' | 'viewport' | 'sha256'
>;

export interface ListedCapture {
	capture: HarnessCapture;
	/** The record whose sealed files hold the bytes: for an inherited result, its origin. */
	record: string;
	focused?: boolean;
}

const unlisted = 'This capture is not listed by the evidence of this entity at these revisions.';

/**
 * The one capture an artifact request names, out of the evidence of one entity read at the
 * revisions the request repeats. It is found only on the side it names, in the record that
 * judges that side, with its scenario, state, evidence, viewport and hash all as listed: a
 * capture of another entity, record, side or revision is not listed, and nothing is given for
 * it. No path or address is ever taken from the request.
 */
export function recordedCapture(
	evidence: ExplorerEvidence,
	binding: CaptureBinding
): ListedCapture {
	const side = evidence[binding.side];
	if (!side) throw new Error(unlisted);
	const found = side.captures.find(
		(item) =>
			item.scenario === binding.scenarioId &&
			item.state === binding.state &&
			item.capture.evidence === binding.evidenceId &&
			(item.capture.viewport ?? null) === binding.viewport &&
			item.capture.sha256 === binding.sha256
	);
	if (!found) throw new Error(unlisted);
	if (found.focused?.record === binding.recordId)
		return { capture: found.capture, record: binding.recordId, focused: true };
	const record = side.record;
	if (!record || record.id !== binding.recordId) throw new Error(unlisted);
	const ran = record.scenarios.find((item) => item.id === binding.scenarioId);
	if (!ran) throw new Error(unlisted);
	return { capture: found.capture, record: ran.origin.record };
}
