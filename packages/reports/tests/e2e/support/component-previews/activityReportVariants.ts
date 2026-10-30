import type { PreviewCases } from './shared';
import { activityListVariant } from './activityListVariants';

/** Route activity inputs to their component-specific fixtures. */
export function activityReportVariant(id: string, props: PreviewCases[string], variant: string) {
	if (id === 'reports.component.activity-list') return activityListVariant(props, variant);
	return null;
}
