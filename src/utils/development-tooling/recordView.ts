import type { VerificationRecord } from '../../core/verification-evidence/verificationTypes';
import type { BrowserDiagnostic } from '../../core/development-tooling/browserDiagnostics';

type Scenario = VerificationRecord['scenarios'][number];
type Capture = Scenario['states'][number]['captures'][number];
type DiagnosticTest = { id: string; status: string; browserErrors?: BrowserDiagnostic[] };

export interface ResolvedMedia {
	/** Path of the original bytes in the output, or null when they are not available. */
	media: string | null;
	gap?: string;
}

/** Finds the bytes of one capture in the record that produced it. */
export type MediaResolver = (capture: Capture, origin: string) => ResolvedMedia;

export interface RecordView {
	id: string;
	status: VerificationRecord['status'];
	valid: boolean;
	problems: string[];
	source: VerificationRecord['source'];
	profile: string;
	startedAt: string;
	finishedAt: string;
	gates: VerificationRecord['gates'];
	failures: string[];
	tests: Array<DiagnosticTest & { kind: string; target: string; durationMs: number }>;
	/** Identity of each declared build as compiled for this record, when any is declared. */
	builds?: VerificationRecord['builds'];
	scenarios: Array<{
		id: string;
		status: Scenario['status'];
		testedRevision: string;
		/** True when the evidence was produced by an earlier record and is only referenced here. */
		inherited: boolean;
		/** The record and commit that actually produced the evidence. */
		origin: { record: string; commit: string };
		/**
		 * For inherited evidence: the checks of this scenario as its origin record ran them, by
		 * their scoped names. Absent when that record could not be read, and for a fresh result.
		 */
		originTests?: DiagnosticTest[];
		states: Array<
			Omit<Scenario['states'][number], 'captures'> & { captures: Array<Capture & ResolvedMedia> }
		>;
	}>;
	measurements: VerificationRecord['measurements'];
	budgets: VerificationRecord['budgets'];
	reasons: { status: string; missing: VerificationRecord['reasons']['missing'] };
}

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
