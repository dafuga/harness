/** The visual state gallery distinguishes coverage, loading, comparison and viewer states. */
export const entityStatesCatalogVariants: Record<string, string[]> = {
	'reports.component.entity-states': [
		'empty',
		'current',
		'missing',
		'rejected',
		'inapplicable',
		'incomparable',
		'loading',
		'load-error',
		'scenario-open',
		'scenario-selected',
		'viewport-open',
		'viewport-mobile',
		'viewer-open'
	]
};
