// @harness-uid u_p5thuojtbt
import type { Evidence, EvidenceVideo } from '../../models/reports-media/Report.types';
import type { FrameClipReference } from '../../../../../src/services/verification-evidence/FrameFlagService.types';
import type {
	HarnessCapture,
	HarnessRecord,
	HarnessRevision
} from '../../models/explorer-ui/Harness.types';
import type { GalleryCaptureContext } from './harnessEvidence.types';
import { evidenceMedia } from '../verification-evidence/evidenceMedia';
import { captureProvenance } from '../reports-media/captureProvenance';

const mediaKinds = ['screenshot', 'audio', 'video'];

/** Preserve the original attached clip identity separately from the selected revision. */
export function captureVideo(
	capture: HarnessCapture,
	reference: FrameClipReference,
	selectedRevision: string,
	freshness: EvidenceVideo['freshness']
): EvidenceVideo | undefined {
	if (capture.kind !== 'video' || !capture.video) return;
	const original = originalClipReference(capture, reference);
	return {
		...capture.video,
		sha256: capture.sha256,
		selectedRevision,
		freshness,
		...(/^[a-f0-9]{64}$/.test(original.record) && /^[a-f0-9]{40}$/.test(original.revision)
			? { reference: original }
			: {})
	};
}

/** Clip-level lineage takes precedence over a freshly tested enclosing scenario. */
export function originalClipReference(
	capture: HarnessCapture,
	fallback: FrameClipReference
): FrameClipReference {
	const origin = capture.videoReference;
	return origin?.record && origin.revision
		? { ...fallback, record: origin.record, revision: origin.revision }
		: fallback;
}

/** Name of a media file under the console's media path. */
export function mediaFile(capture: HarnessCapture): string {
	return (capture.media ?? '').replace(/^media\//, '');
}

/**
 * Turns the recorded captures of one verification into gallery items, so the existing gallery,
 * viewer, player and transcript show history exactly as they show a report. Each item states
 * the build its own capture names, its standing and the attempt it belongs to, so a rejected or
 * inherited capture never reads as tested at the selected revision; a capture whose bytes are
 * not available is kept and marked missing rather than dropped.
 */
export function harnessEvidence(detail: HarnessRevision, record: HarnessRecord): Evidence[] {
	const viewports = new Map(
		detail.registry.scenarios.map((scenario) => [
			scenario.id,
			new Map(scenario.viewports.map((item) => [item.id, `${item.width}px ${item.id}`]))
		])
	);
	const items: Evidence[] = [];
	for (const scenario of record.scenarios) {
		for (const state of scenario.states) {
			for (const capture of state.captures.filter((item) => mediaKinds.includes(item.kind))) {
				items.push(
					galleryEntry(
						detail,
						record,
						{ scenario, state: state.id, capture, order: items.length },
						viewports
					)
				);
			}
		}
	}
	return items;
}

function galleryEntry(
	detail: HarnessRevision,
	record: HarnessRecord,
	context: GalleryCaptureContext,
	viewports: Map<string, Map<string, string>>
): Evidence {
	const { capture, scenario, state, order } = context;
	const origin = captureProvenance(record, scenario, capture);
	return {
		// Two captures may share a state and a viewport; the running number keeps each its own.
		id: `${record.id.slice(0, 8)}-${scenario.id}-${state}-${capture.viewport ?? capture.kind}-${order}`,
		title: capture.video
			? `${scenario.id} · ${state} · ${capture.video.clipId}`
			: `${scenario.id} · ${state}`,
		category: scenario.id,
		state: state,
		file: mediaFile(capture),
		status: origin.standing === 'unvalidated' ? 'not-proven' : capture.status,
		capturedAt: capture.capturedAt,
		viewport: capture.viewport ? viewports.get(scenario.id)?.get(capture.viewport) : undefined,
		standing: origin.label,
		provenance: origin.facts,
		note: `${origin.note}${capture.gap ? ` ${capture.gap}` : ''}`,
		missing: capture.media === null,
		mediaType: evidenceMedia({ file: capture.path, mimeType: capture.mediaType }),
		video: reportVideo(capture, record, scenario, detail.commit),
		mimeType: capture.mediaType,
		durationSeconds: capture.durationSeconds,
		transcript: capture.transcript,
		order: order
	};
}

function reportVideo(
	capture: HarnessCapture,
	record: HarnessRecord,
	scenario: HarnessRecord['scenarios'][number],
	selectedRevision: string
) {
	const descriptor = capture.video;
	if (!descriptor) return;
	let freshness: EvidenceVideo['freshness'] = 'current';
	if (!record.valid || capture.status !== 'passed') freshness = 'stale';
	else if (scenario.inherited || capture.videoReference?.record) freshness = 'inherited';
	return captureVideo(
		capture,
		{
			record: scenario.origin.record,
			revision: scenario.testedRevision,
			unit: descriptor.unit,
			clipId: descriptor.clipId,
			viewport: capture.viewport ?? ''
		},
		selectedRevision,
		freshness
	);
}
