import { children, noop } from './shared';
import type { PreviewCases } from './shared';
import * as d from './explorerData';
import ExplorerContent from '../../../../src/components/explorer-ui/ExplorerContent.svelte';
const components = '/branch/feature%2Forders/components';
const navbar = {
	base: '/harness',
	repository: 'Preview project',
	scope: d.shown.scope,
	index: d.index,
	commits: d.index.revisions,
	href: d.navigation.href,
	onroute: noop
};
export const legacyCases: PreviewCases = {
	'reports.layout.explorer-layout': { base: '/harness', problem: '', missing: null, navbar },
	'reports.component.shared-primitives-loading-state': { label: 'Loading page data…' },
	'reports.component.harness-harness-action': {
		children: children,
		href: '#review',
		lead: 'check'
	},
	'reports.component.harness-harness-console': {
		base: '/harness',
		path: components,
		navigate: noop,
		content: ExplorerContent
	},
	'reports.component.harness-harness-header': {
		base: '/harness',
		problem: '',
		missing: null,
		navbar
	},
	'reports.component.harness-harness-icon': { name: 'components', size: 48, label: 'Component' },
	'reports.component.harness-harness-navbar': navbar,
	'reports.component.harness-harness-selectors': {
		index: d.index,
		branch: 'feature/orders',
		commit: d.commits.middle,
		commits: d.index.revisions,
		bases: null,
		from: '',
		onbranch: noop,
		oncommit: noop,
		onbase: noop
	},
	'reports.component.harness-harness-shell': { base: '/harness' },
	'reports.component.harness-harness-tabs': {
		view: 'contract',
		tabs: [
			{ id: 'overview', label: 'Overview' },
			{ id: 'contract', label: 'Contract' },
			{ id: 'states', label: 'States' }
		],
		onview: noop
	},
	'reports.component.harness-harness-verdict': { passed: true, label: 'Required checks passed' },
	'reports.component.harness-screen': { title: 'Components', content: ExplorerContent }
};
/** The standalone shell reads its address from the browser: it opens where the console case is. */
export const legacyAddresses: Record<string, string> = {
	'reports.component.harness-harness-shell': `/harness${components}`
};
