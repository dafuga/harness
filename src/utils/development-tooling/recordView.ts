import type { MediaResolver, DiagnosticTest, RecordView } from './recordView.types';
import type { VerificationRecord } from '../../core/verification-evidence/verificationTypes';

/**
 * A record as the history index shows it. Every capture points at its original bytes or states
 * why they are missing, and inherited evidence names the record and commit it really came from.
 */
export function recordView(
	record: VerificationRecord,
	context: {
		valid: boolean;
		problems: string[];
		resolve: MediaResolver;
		/** The checks an earlier record ran, by its id; undefined when it cannot be read. */
		origins?: (record: string) => DiagnosticTest[] | undefined;
	}
): RecordView {
	return {
		id: record.id,
		status: record.status,
		valid: context.valid,
		problems: context.problems,
		source: record.source,
		profile: record.profile.id,
		startedAt: record.startedAt,
		finishedAt: record.finishedAt,
		gates: record.gates,
		failures: record.failures,
		tests: record.tests.map(({ id, kind, target, status, durationMs, browserErrors }) => ({
			id,
			kind,
			target,
			status,
			durationMs,
			...(browserErrors ? { browserErrors } : {})
		})),
		...(record.builds ? { builds: record.builds } : {}),
		scenarios: recordedScenarios(record, context),
		measurements: record.measurements,
		budgets: record.budgets,
		reasons: { status: record.reasons.status, missing: record.reasons.missing }
	};
}

function recordedScenarios(record: VerificationRecord, context: Parameters<typeof recordView>[1]) {
	return record.scenarios.map((scenario) => {
		const origin = scenario.referencedRecord ?? record.id;
		const inherited = scenario.status === 'referenced';
		const ran = inherited ? context.origins?.(origin) : undefined;
		const scoped = ran?.filter((test) => test.id.startsWith(`${scenario.id}:`));
		return {
			...(scoped
				? {
						originTests: scoped.map(({ id, status, browserErrors }) => ({
							id,
							status,
							...(browserErrors ? { browserErrors } : {})
						}))
					}
				: {}),
			id: scenario.id,
			status: scenario.status,
			testedRevision: scenario.testedRevision,
			inherited,
			origin: { record: origin, commit: scenario.testedRevision },
			states: scenario.states.map((state) => ({
				...state,
				captures: state.captures.map((capture) => ({
					...capture,
					...context.resolve(capture, origin)
				}))
			}))
		};
	});
}

export type { ResolvedMedia, MediaResolver, RecordView } from './recordView.types';
