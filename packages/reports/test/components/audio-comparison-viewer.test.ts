import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import AudioComparisonViewer from '../../src/components/AudioComparisonViewer.svelte';
import type { Evidence } from '../../src/models/Report.types';

test('the audio viewer retains both originals, transcripts and independent outcomes', () => {
	const before: Evidence = {
		id: 'before',
		title: 'Original audio',
		category: 'Comparison',
		file: 'before.wav',
		phase: 'before',
		comparison: 'voice',
		mediaType: 'audio',
		status: 'failed',
		transcript: 'Original spoken words',
		source: 'First microphone'
	};
	const after: Evidence = {
		...before,
		id: 'after',
		title: 'Updated audio',
		file: 'after.wav',
		phase: 'after',
		status: 'passed',
		transcript: 'Updated spoken words',
		source: 'Second microphone'
	};
	const { body } = render(AudioComparisonViewer, {
		props: { before, after, assetBase: '/assets/', onclose: () => {} }
	});
	expect(body.match(/<audio\b/g)).toHaveLength(2);
	expect(body).toContain('/assets/before.wav');
	expect(body).toContain('/assets/after.wav');
	expect(body).toContain('Original spoken words');
	expect(body).toContain('Updated spoken words');
	expect(body).toContain('Failed');
	expect(body).toContain('Passed');
	expect(body).toContain('First microphone');
	expect(body).toContain('Second microphone');
});
