import { stamp } from './shared';
import type { Report, Evidence } from '../../../../src/models/reports-media/Report.types';
export const picture: Evidence = {
	id: 'activity',
	title: 'Synthetic preview input',
	category: 'Components',
	file: 'synthetic-card-input.svg',
	status: 'passed',
	mediaType: 'image',
	mimeType: 'image/svg+xml',
	capturedAt: stamp,
	viewport: 'Desktop',
	phase: 'after',
	source: 'Representative preview fixture'
};
export const cardPicture: Evidence = {
	...picture,
	id: 'checkout-confirmation',
	title: 'Checkout confirmation',
	category: 'Checkout',
	file: 'checkout-confirmation.svg',
	source: 'Chromium capture',
	provenance: [
		{ label: 'Viewport', value: 'Desktop' },
		{ label: 'Source', value: 'Chromium capture' }
	]
};
export const audio: Evidence = {
	id: 'accessibility-readback',
	title: 'Accessibility review narration',
	category: 'Release review',
	file: 'preview.wav',
	status: 'passed',
	mediaType: 'audio',
	mimeType: 'audio/wav',
	durationSeconds: 42,
	source: 'Screen-reader validation',
	capturedAt: stamp,
	transcript: 'The final review confirms that keyboard labels and evidence links are announced.',
	provenance: [
		{ label: 'Viewport', value: 'Desktop' },
		{ label: 'Review', value: 'Accessibility playback' }
	]
};
export const baselineNarration: Evidence = {
	...audio,
	id: 'baseline-narration',
	title: 'Baseline narration',
	category: 'Voice review',
	phase: 'before',
	source: 'Script review pass',
	capturedAt: stamp,
	transcript: 'The baseline narration needs a calmer final sentence.'
};
export const releaseNarration: Evidence = {
	...audio,
	id: 'release-narration',
	title: 'Release narration',
	category: 'Voice review',
	phase: 'after',
	source: 'Release candidate',
	capturedAt: stamp,
	transcript: 'The release narration is approved for the published walkthrough.'
};
function viewerRecording(item: Evidence): Evidence {
	return {
		...item,
		source: undefined,
		capturedAt: undefined,
		transcript: undefined,
		provenance: undefined
	};
}
export const viewerBaseline = viewerRecording(baselineNarration);
export const viewerRelease = viewerRecording(releaseNarration);
export const galleryItems: Evidence[] = [
	picture,
	{
		...picture,
		id: 'checkout-mobile',
		title: 'Checkout confirmation on mobile',
		category: 'Checkout',
		viewport: 'Mobile',
		source: 'Mobile browser capture'
	},
	{
		...picture,
		id: 'checkout-tablet',
		title: 'Checkout confirmation on tablet',
		category: 'Checkout',
		viewport: 'Tablet',
		source: 'Tablet browser capture'
	},
	baselineNarration,
	releaseNarration
];
export const report: Report = {
	schemaVersion: 1,
	id: 'preview-report',
	project: { id: 'preview-project', name: 'Preview project', path: '/preview' },
	title: 'Component evidence',
	mode: 'feature',
	environment: 'Synthetic browser preview',
	revision: 'b'.repeat(40),
	historical: false,
	startedAt: stamp,
	updatedAt: stamp,
	summary: 'Review the captured component and its checks.',
	status: 'passed',
	state: 'finalized',
	checks: [
		{ id: 'states', title: 'Component states render correctly', status: 'passed', durationMs: 220 }
	],
	evidence: galleryItems,
	findings: [
		{
			id: 'layout',
			title: 'Keyboard navigation is available',
			detail: 'The controls remain usable with the keyboard.',
			status: 'passed'
		}
	],
	coverage: [{ id: 'desktop', title: 'Desktop', status: 'passed' }],
	acceptance: ['The component renders its representative state.']
};
export const group = {
	id: 'inputs',
	title: 'Inputs',
	none: 'No inputs',
	fields: [
		{
			name: 'seconds',
			type: 'number',
			required: false,
			default: 0,
			description: 'Duration in seconds.',
			source: 'declared',
			examples: [{ form: 'literal', value: 90, text: '90' }]
		},
		{
			name: 'label',
			type: 'string',
			required: false,
			defaultKind: 'omitted',
			source: 'missing',
			examples: []
		},
		{
			name: 'override',
			type: 'number | undefined',
			required: false,
			defaultKind: 'undefined',
			source: 'missing',
			examples: []
		}
	]
};
