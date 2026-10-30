/** The visual state gallery distinguishes coverage, loading, comparison and viewer states. */
export const entityStatesCatalogVariants: Record<string, string[]> = {
	'reports.component.entity-states': [
		'empty',
		'current',
		'initial',
		'missing',
		'rejected',
		'inapplicable',
		'coverage-gap',
		'incomparable',
		'loading',
		'load-error',
		'image-error',
		'scenario-open',
		'scenario-selected',
		'viewport-open',
		'viewport-mobile',
		'capture-details-open',
		'viewer-open'
	]
};
