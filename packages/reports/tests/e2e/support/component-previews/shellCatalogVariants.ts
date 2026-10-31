import { harnessIcons } from '../../../../src/utils/explorer-ui/harnessIcons';

/** Real rendering branches of the explorer, evidence panels and navigation shell. */
export const shellCatalogVariants: Record<string, string[]> = {
	'reports.component.brand-mark': ['decorative', 'inline', 'large'],
	'reports.component.harness-entity-artifact': [
		'not-recorded',
		'not-stored',
		'loading',
		'unverified',
		'lost',
		'expanded',
		'raw-open',
		'plain-text',
		'long'
	],
	'reports.component.harness-entity-audio': [
		'comparison',
		'missing-before',
		'missing-after',
		'empty',
		'transcript-closed'
	],
	'reports.component.harness-entity-behavior': [
		'current',
		'initial',
		'empty',
		'unknown',
		'changed',
		'loading',
		'reasons'
	],
	'reports.component.harness-entity-details': ['summary', 'source', 'measurements', 'unmeasured'],
	'reports.component.harness-entity-history': ['empty', 'unread', 'reading', 'unavailable', 'long'],
	'reports.component.harness-entity-link': ['labelled', 'long', 'focused'],
	'reports.component.harness-entity-missing': ['custom-action', 'long'],
	'reports.component.harness-entity-relations': [
		'empty',
		'removed',
		'used-in',
		'uses',
		'models',
		'apis'
	],
	'reports.component.harness-entity-screens': [
		'current',
		'initial',
		'missing',
		'incomparable',
		'viewer-open',
		'mobile-selected'
	],
	'reports.component.harness-entity-sections': [
		'contract',
		'source',
		'used-in',
		'uses',
		'audio',
		'states',
		'tests',
		'table',
		'table-empty',
		'examples',
		'permissions'
	],
	'reports.component.harness-entity-source': ['empty', 'linked', 'tests', 'long'],
	'reports.component.harness-explorer-catalog-screen': [
		'empty',
		'unindexed',
		'search',
		'no-matches',
		'functions',
		'configs',
		'layouts'
	],
	'reports.component.harness-explorer-content': [
		'catalog',
		'pages',
		'source',
		'history',
		'missing',
		'configs',
		'functions',
		'styles',
		'dependencies',
		'translations',
		'modules',
		'permissions',
		'platforms'
	],
	'reports.component.harness-explorer-controls': ['search', 'long', 'focused'],
	'reports.component.harness-explorer-frame': ['unindexed', 'registry-optional', 'source-open'],
	'reports.component.harness-explorer-index': [
		'empty',
		'search',
		'no-matches',
		'layouts',
		'configs'
	],
	'reports.component.harness-explorer-pages-screen': ['empty', 'unindexed', 'search', 'no-matches'],
	'reports.component.harness-harness-action': [
		'button',
		'disabled',
		'plain',
		'trailing-icon',
		'long',
		'focused'
	],
	'reports.component.harness-harness-console': [
		'loading-history',
		'loading-revision',
		'index-error',
		'revision-error',
		'missing',
		'unindexed'
	],
	'reports.component.harness-harness-header': [
		'problem',
		'missing',
		'missing-no-home',
		'long-repository'
	],
	'reports.component.harness-harness-icon': [
		'decorative',
		'inline',
		...Object.keys(harnessIcons).map((name) => `icon-${name}`)
	],
	'reports.component.harness-harness-navbar': [
		'unresolved',
		'no-repository',
		'pages',
		'historical',
		'long-repository',
		'search-open'
	],
	'reports.component.harness-harness-selectors': ['comparison', 'empty', 'tip', 'at-tip', 'long'],
	'reports.component.harness-harness-verdict': [
		'failed',
		'unknown',
		'framed',
		'passed-open',
		'failed-open',
		'unknown-open',
		'long-open'
	],
	'reports.component.shared-primitives-loading-state': ['default-label', 'long', 'reduced-motion']
};
