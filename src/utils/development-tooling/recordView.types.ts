import type { VerificationRecord } from '../../core/verification-evidence/verificationTypes';
import type { BrowserDiagnostic } from '../../core/development-tooling/browserDiagnostics';

export type Scenario = VerificationRecord['scenarios'][number];

export type Capture = Scenario['states'][number]['captures'][number];

export type DiagnosticTest = { id: string; status: string; browserErrors?: BrowserDiagnostic[] };

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
