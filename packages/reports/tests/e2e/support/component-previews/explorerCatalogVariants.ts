/** Explorer collections and usage links each expose their distinct presentations. */
export const explorerCatalogVariants: Record<string, string[]> = {
	'reports.component.networking-security-explorer-permissions-screen': [
		'index',
		'guest',
		'admin',
		'empty',
		'unindexed',
		'not-found',
		'gap',
		'empty-data',
		'endpoint',
		'endpoint-empty',
		'endpoint-unindexed'
	],
	'reports.component.explorer-ui-explorer-translations-screen': [
		'unindexed',
		'empty',
		'english-only',
		'gaps',
		'gaps-open',
		'search',
		'no-matches',
		'language-open',
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
		'all',
		'batch-focused',
		'batch-hovered',
		'functions',
		'pages',
		'configs',
		'configs-open',
		'empty-configs',
		'unlinked'
	],
	'reports.component.explorer-function-card': [
		'service',
		'model',
		'no-usage',
		'many-usage',
		'usage-open'
	],
	// Visual, page, function and unlinked dependency cards have distinct treatments.
	'reports.component.explorer-ui-explorer-module-card': [
		'missing',
		'image-error',
		'function',
		'api',
		'api-no-methods',
		'page',
		'page-missing',
		'layout',
		'layout-missing',
		'unlinked',
		'no-usage',
		'many-usage',
		'usage-open'
	],
	'reports.component.explorer-usage': [
		'empty',
		'many',
		'limited',
		'limit-zero',
		'duplicates',
		'usage-open'
	],
	'reports.component.explorer-usage-link': [
		'visual-open',
		'hover-open',
		'inherited-open',
		'missing-open',
		'image-error-open',
		'function-open',
		'source-enabled',
		'source-disabled',
		'touch'
	]
};
