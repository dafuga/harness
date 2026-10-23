import type { AuditResult } from './adapters/types';
import type { HarnessRuleLimits } from '../../rules/explorer-ui/catalog';

export interface AuditCollectedFileInput {
	root: string;
	path: string;
	extension: string;
	profile: AuditResult['coverage']['profile'];
	limits: HarnessRuleLimits;
}

export interface AuditFileInput {
	root: string;
	path: string;
	extension: string;
	contents: string;
	limits: HarnessRuleLimits;
}
