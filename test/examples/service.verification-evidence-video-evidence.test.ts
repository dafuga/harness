import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { VideoEvidenceService } from '../../src/services/verification-evidence/VideoEvidenceService';
import type { VideoGraphCoverage } from '../../src/services/verification-evidence/VideoEvidenceService.types';

const declaration = {
	schemaVersion: 1,
	viewports: [{ id: 'desktop', width: 1280, height: 720 }],
	clips: [],
	graphs: [
		{
			id: 'checkout',
			unit: 'checkout-flow',
			initial: 'cart',
			terminals: ['complete'],
			states: [
				{ id: 'cart', predicate: 'Cart is visible' },
				{ id: 'complete', predicate: 'Confirmation is visible' }
			],
			edges: [{ id: 'submit', from: 'cart', to: 'complete', action: 'Submit order' }],
			clips: []
		}
	],
	playlists: []
};

test('Reports missing graph coverage without fresh clips', () => {
	const service = new VideoEvidenceService();
	const output: VideoGraphCoverage[] = service.coverage(declaration, []);
	expect(output).toHaveLength(1);
	expect(output[0].complete).toBe(false);
	const result = {
		graph: output[0].graph,
		states: output[0].states,
		edges: output[0].edges,
		clips: output[0].clips,
		complete: output[0].complete,
		missing: output[0].missing
	};
	recordExampleCases(
		{
			unitId: 'service.verification-evidence-video-evidence',
			symbol: 'coverage',
			state: 'reports-missing-graph-coverage-without-fresh-clips',
			evidence: 'examples-cases',
			file: 'reports-missing-graph-coverage-without-fresh-clips.json'
		},
		[
			{
				name: 'unobserved checkout states and transition remain incomplete',
				input: { declaration, observations: [] },
				output: result
			}
		]
	);
});
