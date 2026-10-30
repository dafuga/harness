import type { PreviewCases } from './shared';
const prefix = 'reports.component.shared-primitives-';
export const presentationVariants: Record<string, string[]> = {
	[`${prefix}data-table`]: ['empty', 'long', 'focused'],
	[`${prefix}code-line`]: ['long', 'multiline', 'wrap', 'action-focused', 'inspection-open'],
	[`${prefix}detail-list`]: ['empty', 'long', 'values', 'duplicate-labels'],
	'desktop.component.agent-controls': ['compact', 'empty', 'unavailable'],
	'desktop.component.remote-approval': ['no-projects', 'busy', 'read', 'write'],
	'desktop.component.contract-panel': ['empty', 'missing-description', 'long', 'technical-open'],
	'reports.component.harness-explorer-table': [
		'empty',
		'functions',
		'models',
		'types',
		'services',
		'layouts',
		'apis',
		'platforms'
	]
};
export const presentationCases: PreviewCases = {
	[`${prefix}data-table`]: {},
	[`${prefix}code-line`]: {},
	[`${prefix}detail-list`]: {}
};
