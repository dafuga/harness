import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import AudioComparison from '../../src/components/reports-media/AudioComparison.svelte';
import AudioComparisonViewer from '../../src/components/reports-media/AudioComparisonViewer.svelte';
import type { Evidence } from '../../src/models/reports-media/Report.types';

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
	expect(body.match(/class="audio-icon"/g)).toHaveLength(2);
	expect(body.match(/d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/g)).toHaveLength(2);
	const summary = render(AudioComparison, { props: { before, after, onopen: () => {} } }).body;
	expect(summary.match(/class="audio-icon"/g)).toHaveLength(1);
	expect(summary).toContain('d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"');
	expect(body).toContain('/assets/before.wav');
	expect(body).toContain('/assets/after.wav');
	expect(body).toContain('Original spoken words');
	expect(body).toContain('Updated spoken words');
	expect(body).toContain('Failed');
	expect(body).toContain('Passed');
	expect(body).toContain('First microphone');
	expect(body).toContain('Second microphone');
});
