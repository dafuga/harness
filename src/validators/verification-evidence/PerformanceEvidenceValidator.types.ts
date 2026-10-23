import type { SourceFile } from '../../core/development-tooling/sourceTypes';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type { Measurement } from '../../core/verification-evidence/verificationTypes';

export interface PerformanceEvidenceInput {
	units: ComponentManifest[];
	files: Map<string, SourceFile>;
	measurements: Measurement[];
	commit: string;
	profile: string;
}
