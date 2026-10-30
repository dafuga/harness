import { children, noop, text, example, picker, image } from './shared';
import type { PreviewCases } from './shared';
import { picture, audio, group } from './reportData';
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
	// A raw snippet renders one element, so the synthetic options come in one group.
	'reports.component.select': {
		value: 'desktop',
		label: 'Viewport',
		children: text(
			'<optgroup label="Viewports"><option value="desktop">Desktop</option><option value="mobile">Mobile</option></optgroup>'
		)
	},
	'reports.component.status-badge': { status: 'passed' },
	'reports.component.usage-examples-usage-examples': { examples: [example] }
};
