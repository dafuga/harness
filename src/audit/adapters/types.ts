import type { AuditFinding } from '../types';

export type AuditProfile = 'app' | 'auto' | 'lib';

export interface AuditOptions {
	profile?: AuditProfile;
}

export interface AuditFile {
	absolutePath: string;
	relativePath: string;
	extension: string;
	contents: string;
	lines: string[];
	structuralLines: string[];
	size: number;
}

export interface AuditAdapter {
	id: string;
	label: string;
	profiles: Array<Exclude<AuditProfile, 'auto'>>;
	extensions: string[];
	optionalTools: string[];
	audit(file: AuditFile): AuditFinding[];
}

export interface AuditCoverage {
	profile: Exclude<AuditProfile, 'auto'>;
	adapters: AdapterCoverage[];
	coveredFiles: string[];
	ignoredPaths: string[];
	unknownFiles: string[];
}

export interface AdapterCoverage {
	id: string;
	label: string;
	files: string[];
	extensions: string[];
	optionalTools: string[];
}

export interface AuditResult {
	findings: AuditFinding[];
	coverage: AuditCoverage;
}
