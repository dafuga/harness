export const desktopGameCatalogVariants: Record<string, string[]> = {
	'desktop.component.game-authoring-game-workspace-chips': ['demo', 'readonly', 'with-commit'],
	'desktop.component.game-checkpoint-editor': ['empty', 'readonly', 'empty-rules', 'long'],
	'desktop.component.game-checkpoint-pane': ['adding', 'readonly', 'advanced', 'long'],
	'desktop.component.game-create': ['filled', 'game-2d', 'game-3d', 'unavailable', 'busy', 'error'],
	'desktop.component.game-level-brief': [
		'concept',
		'empty',
		'readonly',
		'busy',
		'error',
		'reviewable',
		'no-model',
		'long'
	],
	'desktop.component.game-level-review': [
		'approved',
		'built',
		'regenerating',
		'error',
		'unavailable',
		'no-providers'
	],
	'desktop.component.game-preview': ['three-dimensional', 'readonly', 'reset'],
	'desktop.component.game-workspace': ['project', 'loading', 'error', 'readonly', 'history'],
	'desktop.component.game-view-fields': ['settings-open', 'readonly', 'gated', 'multiple']
};
