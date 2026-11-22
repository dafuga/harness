// @harness-uid u_23u6t7kx2y
import type { CaptureBinding, ListedCapture } from './recordedCapture.types';
import { CaptureUnlistedError } from './recordedCapture.types';
import type { ExplorerEvidence } from '$reports/models/explorer-ui/Explorer.types';

const unlisted = 'This capture is not listed by the evidence of this entity at these revisions.';

/**
 * The one capture an artifact request names, out of the evidence of one entity read at the
 * revisions the request repeats. It is found only on the side it names, in the record that
 * lists that capture, with its scenario, state, evidence, viewport and hash all as listed: a
 * capture of another entity, record, side or revision is not listed, and nothing is given for
 * it. No path or address is ever taken from the request.
 */
export function recordedCapture(
	evidence: ExplorerEvidence,
	binding: CaptureBinding
): ListedCapture {
	const side = evidence[binding.side];
	if (!side) throw new CaptureUnlistedError(unlisted);
	const found = side.captures.find(
		(item) =>
			item.scenario === binding.scenarioId &&
			item.state === binding.state &&
			item.capture.evidence === binding.evidenceId &&
			(item.capture.viewport ?? null) === binding.viewport &&
			item.capture.sha256 === binding.sha256
	);
	if (!found) throw new CaptureUnlistedError(unlisted);
	if (found.focused?.record === binding.recordId)
		return { capture: found.capture, record: binding.recordId, focused: true };
	const recordId = found.recordId ?? side.record?.id;
	if (recordId !== binding.recordId) throw new CaptureUnlistedError(unlisted);
	const record = side.detail?.records.find(
		(item) => item.id === recordId && item.valid && item.source.commit === side.commit
	);
	if (!record) throw new CaptureUnlistedError(unlisted);
	const ran = record.scenarios.find((item) => item.id === binding.scenarioId);
	if (!ran) throw new CaptureUnlistedError(unlisted);
	return { capture: found.capture, record: ran.origin.record };
}

export type { CaptureBinding, ListedCapture } from './recordedCapture.types';
