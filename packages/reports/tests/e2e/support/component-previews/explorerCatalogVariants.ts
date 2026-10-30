/** Explorer collections and usage links each expose their distinct presentations. */
export const explorerCatalogVariants: Record<string, string[]> = {
	'reports.component.explorer-ui-explorer-translations-screen': [
		'unindexed',
		'empty',
		'gaps',
		'gaps-open',
		'search',
		'no-matches',
		'german',
		'more',
		'missing-values'
	],
	'reports.component.explorer-ui-explorer-platforms': [
		'unindexed',
		'gap',
		'search',
		'no-matches',
		'filter-open',
		'status-configured',
		'status-setup-required',
		'status-not-configured',
		'status-not-recorded',
		'detail-web'
	],
	'reports.component.explorer-ui-explorer-platform-details': [
		'ios',
		'android',
		'desktop',
		'unrecorded',
		'unindexed',
		'gap',
		'not-found',
		'source-unavailable'
	],
	'reports.component.explorer-dependencies-screen': [
		'unindexed',
		'empty',
		'partial',
		'unreadable',
		'filtered',
		'no-matches'
	],
	'reports.component.explorer-catalog-items': [
		'multiple',
		'batched',
		'more',
		'functions',
		'pages',
		'configs',
		'configs-open',
		'empty-configs',
		'unlinked'
	],
	'reports.component.explorer-usage': ['empty', 'many', 'limited', 'limit-zero', 'duplicates'],
	'reports.component.explorer-usage-link': [
		'visual-open',
		'missing-open',
		'function-open',
		'source-enabled',
		'source-disabled',
		'touch'
	]
};
