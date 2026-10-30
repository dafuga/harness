import type { PreviewCases } from './shared';
import { analyticsTaskVariant } from './analyticsTaskVariants';
import { projectActivityVariant, siteActivityVariant } from './projectActivityVariants';
import { activityWorkVariant } from './activityWorkVariants';
import { activityFileVariant } from './activityFileVariants';
import { activityAgentVariant } from './activityAgentVariants';
import type { Models } from '../../../../src/components/reports-media/AnalyticsModels.types';

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
	if (id === 'reports.component.analytics-models' && variant !== 'empty')
		return analyticsModelVariant(props, variant);
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

function analyticsModelVariant(props: PreviewCases[string], variant: string) {
	const models = props.models as Models;
	const checks = models.firstTryByAuthor['gpt-6.1-terra'];
	if (variant === 'unknown')
		return {
			...props,
			models: {
				...models,
				authors: { unknown: 4 },
				loopAuthors: { unknown: 1 },
				evaluators: { unknown: 4 },
				firstTryByAuthor: { unknown: checks }
			}
		};
	if (variant !== 'unassessed') return null;
	const unassessed = {
		...checks.response,
		checks: 4,
		excluded: 4,
		firstTry: { numerator: 0, denominator: 0, rate: null },
		tasks: []
	};
	return {
		...props,
		models: {
			...models,
			firstTryByAuthor: { 'gpt-6.1-terra': { response: unassessed, cleanCode: unassessed } }
		}
	};
}
