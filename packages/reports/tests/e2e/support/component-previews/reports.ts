import { children, noop, text, example, picker, image } from './shared';
import type { PreviewCases } from './shared';
import {
	report,
	picture,
	cardPicture,
	audio,
	group,
	baselineNarration,
	releaseNarration,
	viewerBaseline,
	viewerRelease,
	galleryItems
} from './reportData';
import * as d from './explorerData';
import { explorerSearchEntries } from '../../../../src/utils/explorer-ui/explorerSearchEntries';
import { entitySearch } from '../../../../src/utils/explorer-ui/entitySearch';
import { contractPreviewUnit } from './reportEntityContractVariants';
import { resolveStateImage } from './reportEntityStatesVariants';
const field = group.fields[0];
const entries = explorerSearchEntries(d.entities, d.shown.head.commit);
export const reportCases: PreviewCases = {
	'reports.component.audio-comparison': {
		before: baselineNarration,
		after: releaseNarration,
		onopen: noop
	},
	'reports.component.audio-comparison-viewer': {
		before: viewerBaseline,
		after: viewerRelease,
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
		unit: contractPreviewUnit(d.entity.unit),
		category: 'components',
		contract: d.contract
	},
	'reports.component.entity-examples': {
		documentation: { path: 'README.md', examples: [example] }
	},
	'reports.component.entity-search': {
		entries,
		scope: { label: 'Preview project', pinned: null },
		href: () => '/components',
		open: noop
	},
	'reports.component.entity-search-results': {
		id: 'preview-search',
		found: entitySearch(entries, 'order', 12),
		active: 0,
		loading: false,
		query: 'order',
		scope: 'Preview project',
		href: () => '/components',
		choose: noop
	},
	'reports.component.entity-states': {
		name: 'OrderList',
		evidence: d.evidence,
		scope: d.shown.scope,
		mediaBase: '/media/',
		resolveImage: resolveStateImage
	},
	'reports.component.evidence-card': { item: cardPicture, assetBase: '/media/', onopen: noop },
	'reports.component.evidence-grid': { items: galleryItems, assetBase: '/media/' },
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
		row: d.helperRows[0],
		nav: d.navigation,
		lens: d.reading,
		mediaBase: '/media/'
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
					commit: 'a71f5d4e9271dc1d5be988c980d99c808b23f041',
					assertion: 'Requires its own screenshot.',
					command: 'harness verify run',
					output: 'Expected screenshot to exist.'
				},
				green: {
					commit: 'd5c82a9b1e7f3d44c2a98e609b7f4a33cc140df2',
					output: 'Required screenshots passed.'
				}
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
	// A raw snippet renders one element, so the synthetic options come in one group.
	'reports.component.select': {
		value: 'desktop',
		label: 'Viewport',
		children: text(
			'<optgroup label="Viewports"><option value="desktop">Desktop</option><option value="mobile">Mobile</option></optgroup>'
		)
	},
	'reports.component.status-badge': { status: 'passed' },
	'reports.component.upload-audio': { reportId: 'preview-report', onUploaded: noop },
	'reports.component.upload-comparison': { reportId: 'preview-report', onUploaded: noop },
	'reports.component.usage-examples-usage-examples': { examples: [example] }
};
