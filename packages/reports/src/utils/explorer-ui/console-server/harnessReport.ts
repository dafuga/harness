import { harnessEvidence } from '../harnessEvidence';
import type { Report } from '../../../models/reports-media/Report.types';
import type {
	HarnessRecord,
	HarnessRevision,
	HarnessRevisionSummary
} from '../../../models/explorer-ui/Harness.types';
import { scenarioOrigin } from '../../reports-media/captureProvenance';

const short = (commit: string) => commit.slice(0, 7);

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
