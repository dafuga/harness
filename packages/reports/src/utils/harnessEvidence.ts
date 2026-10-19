import type { Evidence } from '../models/Report.types';
import type { HarnessCapture, HarnessRecord, HarnessRevision } from '../models/Harness.types';
import { captureProvenance } from './captureProvenance';

const mediaKinds = ['screenshot', 'audio'];

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
				const audio = capture.kind === 'audio';
				const origin = captureProvenance(record, scenario, capture);
				items.push({
					// Two captures may share a state and a viewport; the running number keeps each its own.
					id: `${record.id.slice(0, 8)}-${scenario.id}-${state.id}-${capture.viewport ?? capture.kind}-${items.length}`,
					title: `${scenario.id} · ${state.id}`,
					category: scenario.id,
					file: mediaFile(capture),
					status: origin.standing === 'unvalidated' ? 'not-proven' : capture.status,
					capturedAt: capture.capturedAt,
					viewport: capture.viewport
						? viewports.get(scenario.id)?.get(capture.viewport)
						: undefined,
					standing: origin.label,
					provenance: origin.facts,
					note: `${origin.note}${capture.gap ? ` ${capture.gap}` : ''}`,
					missing: capture.media === null,
					mediaType: audio ? 'audio' : 'image',
					mimeType: capture.mediaType,
					durationSeconds: capture.durationSeconds,
					transcript: capture.transcript,
					order: items.length
				});
			}
		}
	}
	return items;
}

export { harnessReport } from './console-server/harnessEvidence';
