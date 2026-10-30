import type { PreviewCases } from './shared';
import { analyticsTaskVariant } from './analyticsTaskVariants';
import { projectActivityVariant, siteActivityVariant } from './projectActivityVariants';
import { activityWorkVariant } from './activityWorkVariants';
import { activityFileVariant } from './activityFileVariants';
import { activityAgentVariant } from './activityAgentVariants';

/** Route activity and analytics inputs to their component-specific fixtures. */
export function activityReportVariant(id: string, props: PreviewCases[string], variant: string) {
	if (id === 'reports.component.analytics-cpu') return { ...props };
	if (id === 'reports.component.analytics-filters' && variant === 'all-filters')
		return {
			filters: {
				loop: 'release-check',
				task: 'verify',
				model: 'GPT 6.1',
				since: '2026-10-20',
				until: '2026-10-26'
			}
		};
	if (id === 'reports.component.activity-files') return activityFileVariant(props, variant);
	if (id === 'reports.component.activity-agents') return activityAgentVariant(props, variant);
	if (id === 'reports.component.site-activity') return siteActivityVariant(props, variant);
	if (id === 'reports.component.activity-work') return activityWorkVariant(props, variant);
	if (id === 'reports.component.analytics-tasks' && variant !== 'empty')
		return analyticsTaskVariant(props, variant);
	if (
		id === 'reports.component.project-activity' &&
		['empty', 'stale', 'failed-read'].includes(variant)
	)
		return projectActivityVariant(props, variant);
	return null;
}
