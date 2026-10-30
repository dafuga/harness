/** The footer has separate empty, deduplicated and limited consumer views. */
export const explorerUsageCatalogVariants: Record<string, string[]> = {
	'reports.component.explorer-usage': ['empty', 'many', 'limited', 'limit-zero', 'duplicates'],
	'reports.component.entity-states': [
		'empty',
		'current',
		'missing',
		'rejected',
		'inapplicable',
		'incomparable',
		'loading',
		'load-error',
		'viewport-mobile',
		'viewer-open'
	]
};
