import type { Measurement } from '../../core/verification-evidence/verificationTypes';
import type { RuntimeKind } from '../../core/development-tooling/unitTypes';

export interface RuntimeChoiceInput {
	measurements: Array<Omit<Measurement, 'testedRevision'>>;
	workload: string;
	profile: string;
}

export interface RuntimeChoice {
	runtime: RuntimeKind;
	/** `unmeasured` means no usable measurement exists and the reference was kept. */
	basis: 'measured' | 'unmeasured';
	workload: string;
	profile: string;
	rule: string;
	candidates: Array<{ runtime: RuntimeKind; coldMs: number }>;
	excluded: Array<{ runtime: RuntimeKind; reason: string }>;
}
