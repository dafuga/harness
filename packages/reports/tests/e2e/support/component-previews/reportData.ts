import { stamp } from './shared';
import type { Report, Evidence } from '../../../../src/models/Report.types';
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
export const audio: Evidence = {
	id: 'spoken',
	title: 'Spoken confirmation',
	category: 'Audio',
	file: 'preview.wav',
	status: 'passed',
	mediaType: 'audio',
	mimeType: 'audio/wav',
	durationSeconds: 1,
	transcript: 'The activity list is ready.'
};
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
	evidence: [picture, audio],
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
			description: 'Duration in seconds.',
			source: 'declared',
			examples: [{ form: 'literal', value: 90, text: '90' }]
		}
	]
};
