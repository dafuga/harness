import type { ReviewInputFile } from '../development-tooling/cleanCodeFiles';
import type { AuditFinding } from '../development-tooling/types';

export interface ReviewSnapshot {
	target: ReviewInputFile;
	inputs: ReviewInputFile[];
	contextHash: string;
	state: string;
	contextPaths: string[];
	omittedContext: string[];
}

export interface SnapshotInput {
	root: string;
	path: string;
	files: string[];
	findings: AuditFinding[];
}

export interface SnapshotState {
	target: { path: string; language: string; code: string };
	related: Array<{ path: string; code: string }>;
	conventions: Array<{ path: string; text: string; partial: boolean }>;
	auditFindings: AuditFinding[];
	omittedContext: string[];
}
