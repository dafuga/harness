import { comparePanesPreview } from './comparePanesPreview';
import type { PreviewCases } from './shared';
const prefix = 'reports.component.shared-primitives-';
export const presentationVariants: Record<string, string[]> = {
	[`${prefix}compare-panes`]: ['single', 'missing-parent', 'missing-selected', 'details'],
	[`${prefix}data-table`]: ['empty', 'empty-unprovided', 'long', 'focused'],
	[`${prefix}code-line`]: ['long', 'multiline', 'wrap', 'action-focused', 'inspection-open'],
	[`${prefix}detail-list`]: [
		'empty',
		'empty-unprovided',
		'long',
		'values',
		'duplicate-labels',
		'flat',
		'attributes'
	],
	'desktop.component.agent-controls': ['compact', 'empty', 'unavailable'],
	'desktop.component.choice-dialog': ['closed', 'empty', 'disabled'],
	'desktop.component.remote-approval': ['unselected', 'no-projects', 'busy', 'read', 'write'],
	'desktop.component.contract-panel': ['empty', 'missing-description', 'long', 'technical-open'],
	'reports.component.harness-explorer-table': [
		'empty',
		'long-string',
		'multiline-string',
		'expression',
		'long-expression',
		'value-open',
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
	[`${prefix}compare-panes`]: comparePanesPreview(),
	[`${prefix}data-table`]: {},
	[`${prefix}code-line`]: {},
	[`${prefix}detail-list`]: {}
};
