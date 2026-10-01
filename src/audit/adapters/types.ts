import type { AuditFinding } from '../types';
import type { HarnessRuleLimits } from '../../rules/catalog';
import type { CleanCodeConfig, CleanCodeOptions, CleanCodeReport } from '../cleanCodeTypes';

export type AuditProfile = 'app' | 'auto' | 'dapp' | 'lib';

export interface AuditOptions {
	profile?: AuditProfile;
	cleanCode?: CleanCodeOptions;
}

export interface AuditConfig {
	cleanCode?: CleanCodeConfig;
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
	cleanCode?: CleanCodeReport;
	findings: AuditFinding[];
	coverage: AuditCoverage;
}

export interface AuditStructure {
	profile: Exclude<AuditProfile, 'auto'>;
	files: string[];
	dirs: string[];
}
