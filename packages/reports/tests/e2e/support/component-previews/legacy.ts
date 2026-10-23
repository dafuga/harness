import { children, noop } from './shared';
import type { PreviewCases } from './shared';
import * as d from './explorerData';
import ExplorerContent from '../../../../src/components/harness/ExplorerContent.svelte';
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
	'reports.component.harness-harness-action': {
		children: children,
		href: '#review',
		lead: 'check'
	},
	'reports.component.harness-harness-activity': { client: d.client, base: '/harness' },
	'reports.component.harness-harness-compare-media': {
		base: d.shown.parent,
		head: d.shown.head,
		mediaBase: '/media/'
	},
	'reports.component.harness-harness-compare': {
		base: d.shown.parent,
		head: d.shown.head,
		client: d.client,
		mediaBase: '/media/',
		selected: d.ids.list,
		onselect: noop
	},
	'reports.component.harness-harness-console': {
		base: '/harness',
		path: components,
		navigate: noop,
		content: ExplorerContent
	},
	'reports.component.harness-harness-emitted-growth': {
		unit: d.ids.list,
		growth: {
			targets: [{ id: 'module', label: 'Module' }],
			rows: [
				{
					commit: d.commits.middle,
					subject: 'feat: activity previews',
					cells: { module: { value: 2048, limit: 2200, delta: -100 } },
					reviews: [],
					changed: false
				}
			]
		},
		reasons: () => [],
		oncompare: noop
	},
	'reports.component.harness-harness-failures': {
		record: 'preview-record',
		failures: ['The mobile screenshot needs to be captured.'],
		problems: []
	},
	'reports.component.harness-harness-growth': {
		index: d.index,
		client: d.client,
		unit: d.ids.list,
		onunit: noop
	},
	'reports.component.harness-harness-header': {
		base: '/harness',
		problem: '',
		missing: null,
		navbar
	},
	'reports.component.harness-harness-history': {
		summary: d.index.revisions[1],
		detail: d.shown.head,
		mediaBase: '/media/',
		exportHref: ''
	},
	'reports.component.harness-harness-icon': { name: 'components', size: 48, label: 'Component' },
	'reports.component.harness-harness-legacy': {
		reports: [
			{
				id: 'preview-legacy-report',
				title: 'Synthetic report from before Git records',
				mode: 'feature',
				environment: 'Synthetic browser preview',
				status: 'passed',
				startedAt: '2026-10-19T10:00:00Z',
				revision: d.commits.first,
				linked: d.commits.first,
				summary: 'Recorded before verification was kept in Git; no file of it is a capture.',
				checks: [{ id: 'states', title: 'Component states render', status: 'passed' }],
				media: []
			}
		],
		commit: d.commits.middle,
		known: new Set(Object.values(d.commits)),
		mediaBase: '/media/',
		onselect: noop
	},
	'reports.component.harness-harness-map': {
		units: d.shown.head.registry.units,
		selected: d.ids.list,
		onselect: noop
	},
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
	'reports.component.harness-harness-unit': {
		unit: d.entity.unit,
		units: d.shown.head.registry.units,
		scenarios: d.shown.head.registry.scenarios,
		records: d.shown.head.records,
		onselect: noop
	},
	'reports.component.harness-harness-verdict': { passed: true, label: 'Required checks passed' },
	'reports.component.harness-screen': { title: 'Components', content: ExplorerContent }
};
/** The standalone shell reads its address from the browser: it opens where the console case is. */
export const legacyAddresses: Record<string, string> = {
	'reports.component.harness-harness-shell': `/harness${components}`
};
