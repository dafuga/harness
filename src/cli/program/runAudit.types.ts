import type { AnalyticsContext } from '../../core/reports-media/analyticsTypes';

export interface AuditCommandOptions extends AnalyticsContext {
	profile?: string;
	coverage?: boolean;
	json?: boolean;
	cleanCode?: boolean;
	gate?: boolean;
	dryRun?: boolean;
	refresh?: boolean;
}
