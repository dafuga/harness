// @harness-uid u_54pbrlpc6d
import type { ExplorerCapture, ExplorerSide } from '../../../models/explorer-ui/Explorer.types';
import type { Phase } from '../entityScreens.types';
import type { EvidenceVideo } from '../../../models/reports-media/Report.types';
import type { HarnessRecord } from '../../../models/explorer-ui/Harness.types';
import { captureVideo } from '../harnessEvidence';

/** A gallery side can display a newer revision than the record that produced its video. */
export function videoCapture(
	side: ExplorerSide,
	found: ExplorerCapture,
	phase: Phase
): EvidenceVideo | undefined {
	const record = side.detail?.records.find((item) => item.id === found.recordId) ?? side.record;
	const result = record?.scenarios.find((item) => item.id === found.scenario);
	const { capture } = found;
	const descriptor = capture.video;
	if (!descriptor) return;
	return captureVideo(
		capture,
		{
			record: originRecord(result, found.recordId),
			revision: result?.testedRevision ?? capture.server?.revision ?? '',
			unit: descriptor.unit,
			clipId: descriptor.clipId,
			viewport: capture.viewport ?? ''
		},
		side.commit,
		freshness(found, phase)
	);
}

function originRecord(result: HarnessRecord['scenarios'][number] | undefined, record?: string) {
	if (result?.inherited) return result.origin.record;
	return record ?? result?.origin.record ?? '';
}

function freshness(found: ExplorerCapture, phase: Phase): EvidenceVideo['freshness'] {
	if (!found.usable) return 'stale';
	if (found.inheritedFrom) return 'inherited';
	return phase === 'before' ? 'historical' : 'current';
}
