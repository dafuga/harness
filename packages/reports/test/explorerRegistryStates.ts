const at = 'reports.page.harness-branch-branch-at-';

// What each Shells state shows, written out here rather than read from the scenario: the page it
// is reached on and, where an old Components address is corrected, the correction too.
const corrected = 'reports.function.corrected-location';
const shellStates: Array<[string, string[]]> = [
	['layouts', [`${at}layouts`]],
	['shells-tip', [`${at}layouts`]],
	['shell', [`${at}layouts-entity`]],
	['shell-details', [`${at}layouts-entity`]],
	['shell-history', [`${at}layouts-entity-history`]],
	['shell-redirect', [`${at}layouts-entity`, corrected]],
	['shell-earlier', [`${at}components-entity`, corrected]],
	['shell-retained', ['reports.page.harness-view']]
];
// What each search state shows, written out here: the catalog it is typed on, the adapter of the
// console, the search of the bar and the shared field with its results.
const searching = [
	'reports.function.explorer-search-entries',
	'reports.function.navbar-search',
	'reports.function.entity-search',
	'reports.component.entity-search',
	'reports.component.entity-search-results'
];
const searchStates: Array<[string, string[]]> = [
	['search', [`${at}layouts`, ...searching]],
	['search-pinned', [`${at}functions`, ...searching]]
];
const contracts = [
	'reports.component.entity-contract',
	'reports.function.contract-fields',
	`${at}functions-entity`
];
const contractStates: Array<[string, string[]]> = [
	['contract', contracts],
	['contract-commit', contracts],
	[
		'contract-example',
		[...contracts, 'reports.component.contract-example', 'reports.component.modal']
	],
	[
		'contract-example-commit',
		[...contracts, 'reports.component.contract-example', 'reports.component.modal']
	]
];
export const written: Array<[string, string[]]> = [
	...shellStates,
	...searchStates,
	...contractStates
];
