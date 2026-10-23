import type { AnalyticsFilter } from '../../core/reports-media/analyticsTypes';

export interface AnalyticsOptions extends AnalyticsFilter {
	json?: boolean;
	/** Limits everything to events recorded in checkouts of the repository at this path. */
	site?: string;
	root?: string;
	output?: string;
}
