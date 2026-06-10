import type { AuditFinding } from '../types';
import type { HarnessRuleLimits } from '../../rules/catalog';

export type AuditProfile = 'app' | 'auto' | 'dapp' | 'lib';

export interface AuditOptions {
	profile?: AuditProfile;
}

export interface AuditConfig {
	ignore?: AuditIgnore[];
	limits?: Partial<HarnessRuleLimits>;
}

export interface AuditIgnore {
	path: string;
	rule?: string;
	reason?: string;
}

export interface AuditFile {
	absolutePath: string;
	relativePath: string;
	extension: string;
	contents: string;
	lines: string[];
	structuralLines: string[];
	limits: HarnessRuleLimits;
	size: number;
}

export interface AuditAdapter {
	id: string;
	label: string;
	profiles: Array<Exclude<AuditProfile, 'auto'>>;
	extensions: string[];
	optionalTools: string[];
	audit(file: AuditFile): AuditFinding[];
	auditStructure?(structure: AuditStructure): AuditFinding[];
}

export interface AuditCoverage {
	profile: Exclude<AuditProfile, 'auto'>;
	adapters: AdapterCoverage[];
	coveredFiles: string[];
	ignoredPaths: string[];
	ignoredFindings: AuditFinding[];
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

export interface AuditStructure {
	profile: Exclude<AuditProfile, 'auto'>;
	files: string[];
	dirs: string[];
}
