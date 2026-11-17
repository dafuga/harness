import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { VideoDeclaration } from '../../src/utils/verification-evidence/videoClipSchema.types';
import { videoClipSchema } from '../../src/utils/verification-evidence/videoClipSchema';

function declaration(viewports: string[]): VideoDeclaration {
	return {
		schemaVersion: 1,
		viewports: [{ id: 'desktop', width: 1280, height: 720 }],
		clips: [{
			id: 'checkout-ready', unit: 'page.checkout', state: 'ready', viewports,
			inputs: ['fixtures/checkout.json'], script: { path: 'record/checkout.ts', export: 'record' },
			fixture: 'fixtures/checkout.json', entry: 'start', exit: 'done', states: ['start', 'done'],
			edges: ['submit'], durationSeconds: 4
		}],
		graphs: [{
			id: 'checkout-flow', unit: 'page.checkout', initial: 'start', terminals: ['done'],
			states: [{ id: 'start', predicate: 'form is visible' }, { id: 'done', predicate: 'receipt is visible' }],
			edges: [{ id: 'submit', from: 'start', to: 'done', action: 'submit checkout' }], clips: ['checkout-ready']
		}],
		playlists: [{ id: 'smoke', clips: ['checkout-ready'] }]
	};
}

test('Validates video declarations and rejects unknown clip viewports', () => {
	const validInput = declaration(['desktop']);
	const valid = videoClipSchema(validInput);
	expect(valid.clips.map((clip) => clip.id)).toEqual(['checkout-ready']);
	const invalidInput = declaration(['tablet']);
	let error = '';
	try {
		videoClipSchema(invalidInput);
	} catch (cause) {
		error = cause instanceof Error ? cause.name : 'unknown';
	}
	expect(error).toBe('ZodError');
	const state = 'validates-video-declarations-and-rejects-unknown-clip-viewpo';
	recordExampleCases(
		{
			unitId: 'function.verification-evidence-video-clip-schema',
			symbol: 'videoClipSchema', state, evidence: 'examples-cases', file: `${state}.json`
		},
		[
			{ name: 'consistent clip, graph and viewport references', input: validInput, output: { clipIds: valid.clips.map((clip) => clip.id), graphIds: valid.graphs.map((graph) => graph.id) } },
			{ name: 'clip references an undeclared viewport', input: invalidInput, error }
		]
	);
});
