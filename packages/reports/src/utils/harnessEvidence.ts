import type { Evidence, Report } from '../models/Report.types';
import type {
	HarnessCapture,
	HarnessRecord,
	HarnessRevision,
	HarnessRevisionSummary
} from '../models/Harness.types';
import { captureProvenance, scenarioOrigin } from './captureProvenance';

const short = (commit: string) => commit.slice(0, 7);
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
					id: `${record.id.slice(0, 8)}-${scenario.id}-${state.id}-${capture.viewport ?? capture.kind}`,
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

/** One recorded verification as a report, for the existing report view and portable export. */
export function harnessReport(
	summary: HarnessRevisionSummary,
	detail: HarnessRevision,
	record: HarnessRecord
): Report {
	const coverage = record.scenarios.flatMap((scenario) =>
		scenario.states.map((state) => ({
			id: `${scenario.id}-${state.id}`,
			title: `${scenario.id}: ${state.id}`,
			status: stateStatus(state),
			detail: state.reason ?? scenarioOrigin(scenario)
		}))
	);
	return {
		schemaVersion: 1,
		id: `harness-${short(summary.commit)}-${record.id.slice(0, 8)}`,
		project: { id: 'harness', name: 'Harness history', path: '' },
		title: summary.subject,
		mode: 'feature',
		environment: `profile ${record.profile}`,
		revision: summary.commit,
		historical: true,
		startedAt: record.startedAt,
		updatedAt: record.finishedAt,
		summary: record.failures.length ? record.failures.join(' ') : 'Every gate passed.',
		status: record.status,
		state: 'finalized',
		checks: record.tests.map((test) => ({
			id: test.id,
			title: test.target,
			status: test.status,
			durationMs: test.durationMs,
			group: test.kind
		})),
		evidence: harnessEvidence(detail, record),
		findings: record.failures.map((failure, index) => ({
			id: `failure-${index + 1}`,
			title: failure,
			detail: '',
			status: 'failed'
		})),
		coverage,
		acceptance: Object.entries(record.gates ?? {}).map(([gate, outcome]) => `${gate}: ${outcome}`)
	};
}

function stateStatus(state: HarnessRecord['scenarios'][number]['states'][number]) {
	if (state.coverage === 'inapplicable') return 'skipped' as const;
	if (state.coverage === 'missing') return 'not-proven' as const;
	if (state.captures.length === 0) return 'not-proven' as const;
	return state.captures.every((capture) => capture.status === 'passed')
		? ('passed' as const)
		: ('failed' as const);
}
