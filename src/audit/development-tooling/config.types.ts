import type { CleanCodeSettings } from './cleanCodeTypes';
import type { AuditIgnore } from './adapters/types';
import type { HarnessRuleLimits } from '../../rules/explorer-ui/catalog';

export interface ResolvedAuditConfig {
	cleanCode: CleanCodeSettings;
	ignore: AuditIgnore[];
	limits: HarnessRuleLimits;
}
