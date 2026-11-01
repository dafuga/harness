/** Distinct presentations reached through the Desktop components' normal props and controls. */
export const desktopCatalogVariants: Record<string, string[]> = {
	'desktop.component.agent-settings': ['selected', 'not-saved'],
	'desktop.component.agents-providers-chat-agents': [
		'loading',
		'unavailable',
		'empty',
		'never-used',
		'unreadable',
		'stale',
		'stale-reading',
		'many',
		'historical',
		'refresh-error'
	],
	'desktop.component.catalog-view': ['empty', 'search-empty', 'filters-open', 'long'],
	'desktop.component.composer': [
		'plan',
		'ask',
		'change',
		'visual-plan',
		'running',
		'unapproved',
		'no-modes',
		'no-provider',
		'long',
		'compact',
		'retry'
	],
	'desktop.component.design-panel': [
		'empty',
		'headless',
		'headless-plan',
		'loading',
		'error',
		'readonly',
		'long'
	],
	'desktop.component.entity-view': [
		'source',
		'designs',
		'used-in',
		'uses',
		'apis',
		'states',
		'history',
		'conversation-closed',
		'helper-examples'
	],
	'desktop.component.environment-picker': ['stage', 'preprod', 'prod', 'with-action'],
	'desktop.component.history-panel': ['empty', 'incomplete', 'more', 'loading', 'error', 'long'],
	'desktop.component.nav-bar': ['readonly', 'account', 'game'],
	'desktop.component.project-gate': [
		'available',
		'busy',
		'recent',
		'remote-empty',
		'remote-projects'
	],
	'desktop.component.project-switcher': ['open', 'shared', 'empty', 'busy', 'long'],
	'desktop.component.revision-picker': [
		'branch-open',
		'commit-open',
		'environment',
		'historical',
		'pinned',
		'unknown-time'
	],
	'desktop.component.runtime-artifact': [
		'output',
		'missing',
		'unstored',
		'loading',
		'unreadable',
		'text',
		'recorded-open',
		'json-open'
	],
	'desktop.component.runtime-behavior': ['paired', 'loading', 'unreadable', 'empty'],
	'desktop.component.runtime-evidence': ['planned', 'unavailable', 'loading', 'error', 'offline'],
	'desktop.component.runtime-screens': ['empty', 'paired', 'incomparable']
};
