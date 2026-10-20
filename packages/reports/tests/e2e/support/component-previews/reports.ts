import { children, noop, text, example, picker, image } from './shared';
import type { PreviewCases } from './shared';
import { report, picture, audio, group } from './reportData';
import * as d from './explorerData';
const field = group.fields[0];
const entries = d.entities.map((e) => ({
	id: e.id,
	name: e.name,
	title: e.name,
	category: e.category,
	purpose: e.purpose,
	entity: e.id
}));
export const reportCases: PreviewCases = {
	'reports.component.audio-comparison': {
		before: { ...audio, id: 'before', title: 'Before' },
		after: { ...audio, id: 'after', title: 'After' },
		onopen: noop
	},
	'reports.component.audio-comparison-viewer': {
		before: { ...audio, id: 'before', title: 'Before' },
		after: { ...audio, id: 'after', title: 'After' },
		assetBase: '/media/',
		onclose: noop
	},
	'reports.component.audio-evidence': { item: audio, assetBase: '/media/' },
	'reports.component.audio-upload-files': { mode: 'single', uploading: false },
	'reports.component.brand-mark': { size: 56, label: 'Harness' },
	'reports.component.browser-errors': {
		diagnostics: [
			{
				test: 'Documented rejection state',
				file: 'preview.spec.ts',
				project: 'Chromium',
				retry: 0,
				errors: [
					{
						type: 'console',
						message: 'Preview example rejected',
						page: 'http://component.fixture/'
					}
				],
				expected: [
					{
						type: 'console',
						message: 'Preview example rejected',
						reason: 'This fixture displays a documented rejection.'
					}
				]
			}
		]
	},
	'reports.component.console-chat': {
		base: '/harness',
		path: '/branch/feature%2Forders/components',
		navigate: noop
	},
	'reports.component.contract-example': { field },
	'reports.component.contract-table': { group, onexample: noop },
	'reports.component.coverage-list': { report },
	'reports.component.entity-cases': { examples: [example] },
	'reports.component.entity-contract': {
		unit: d.entity.unit,
		category: 'components',
		contract: d.contract
	},
	'reports.component.entity-examples': { documentation: { examples: [example] } },
	'reports.component.entity-search': {
		entries,
		scope: { label: 'Preview project', pinned: null },
		href: () => '/components',
		open: noop
	},
	'reports.component.entity-search-results': {
		id: 'preview-search',
		found: entries,
		active: 0,
		loading: false,
		query: 'order',
		scope: 'Preview project',
		href: () => '/components',
		choose: noop
	},
	'reports.component.entity-states': {
		name: 'Activity list',
		evidence: d.evidence,
		scope: d.shown.scope,
		mediaBase: '/media/'
	},
	'reports.component.evidence-card': { item: picture, assetBase: '/media/', onopen: noop },
	'reports.component.evidence-grid': { items: [picture], assetBase: '/media/' },
	'reports.component.evidence-provenance': {
		item: {
			...picture,
			provenance: [
				{ label: 'Viewport', value: 'Desktop' },
				{ label: 'Source', value: 'Browser capture' }
			]
		}
	},
	'reports.component.evidence-viewer': {
		items: [picture],
		navigableItems: [picture],
		selected: picture,
		assetBase: '/media/',
		onclose: noop,
		onselect: noop
	},
	'reports.component.explorer-function-card': {
		row: {
			...d.rows[0],
			helper: {
				name: 'formatDuration',
				source: 'duration.ts',
				inputs: [{ name: 'seconds', type: 'number' }],
				pure: true
			},
			usedIn: []
		},
		nav: d.navigation
	},
	'reports.component.filter-dialog': {
		children: text('<label>Verification<select><option>Any result</option></select></label>'),
		onreset: noop,
		active: 0
	},
	'reports.component.floating-chat': {
		open: true,
		label: 'Work with agent',
		panelLabel: 'Project chat',
		title: 'Project chat',
		children
	},
	'reports.component.gameplay-replay': {
		report: { ...report, evidence: [picture] },
		assetBase: '/media/',
		portable: true
	},
	'reports.component.image-zoom': { src: image, alt: 'Activity list preview' },
	'reports.component.modal': {
		open: true,
		title: 'Recorded example',
		variant: 'text',
		children,
		onclose: noop
	},
	'reports.component.provider-picker': { label: 'Model picker' },
	'reports.component.provider-picker-cards': {
		active: picker.active,
		request: picker.request,
		models: picker.models,
		providers: { openai: 'OpenAI', 'harness-claude': 'Claude' },
		locked: false,
		oncancel: noop
	},
	'reports.component.recorded-value': { value: { current: true, working: 1, labels: ['Working'] } },
	'reports.component.regression-proof': {
		unit: d.ids.list,
		href: () => '/history',
		items: [
			{
				loop: 'component-previews',
				units: [d.ids.list],
				red: {
					commit: d.commits.first,
					assertion: 'Requires its own screenshot.',
					command: 'harness verify run',
					output: 'Expected screenshot to exist.'
				},
				green: { commit: d.commits.middle, output: 'Required screenshots passed.' }
			}
		]
	},
	'reports.component.replay-controls': {
		playing: false,
		index: 0,
		count: 3,
		elapsed: 0,
		total: 15,
		title: 'Activity list',
		scene: 1,
		scenes: [1, 2],
		fullscreen: false,
		ontoggle: noop,
		onseek: noop,
		onscene: noop,
		onfullscreen: noop
	},
	'reports.component.report-checks': { checks: report.checks },
	'reports.component.report-findings': { findings: report.findings },
	'reports.component.report-summary': { report, downloadBase: '/exports/', portable: true },
	'reports.component.report-view': {
		report,
		assetBase: '/media/',
		downloadBase: '/exports/',
		portable: true
	},
	'reports.component.select': {
		value: 'desktop',
		label: 'Viewport',
		children: text('<option value="desktop">Desktop</option><option value="mobile">Mobile</option>')
	},
	'reports.component.status-badge': { status: 'passed' },
	'reports.component.upload-audio': { reportId: 'preview-report', onUploaded: noop },
	'reports.component.upload-comparison': { reportId: 'preview-report', onUploaded: noop },
	'reports.component.usage-examples-usage-examples': { examples: [example] }
};
