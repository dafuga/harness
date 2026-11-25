import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { previewSummary } from '../../src/components/game-authoring/game-preview/gamePreviewReading';
import type { PreviewSummaryInput } from '../../src/components/game-authoring/game-preview/gamePreviewReading';

const READY: PreviewSummaryInput = {
	readonly: false,
	transportReady: true,
	available: true,
	status: 'off',
	left: 0,
	note: '',
	limit: 120,
	rate: 0.5
};

export function summary(over: Partial<PreviewSummaryInput>): string {
	return previewSummary({ ...READY, ...over });
}

test('explains why the AI video cannot run', () => {
	const inputs: Partial<PreviewSummaryInput>[] = [
		{ readonly: true, transportReady: false },
		{ transportReady: false },
		{ available: false }
	];
	const outputs = inputs.map(summary);

	expect(outputs).toEqual([
		'AI video is disabled in this read-only preview.',
		'Live AI is not configured for this build.',
		'AI video needs a saved project open in the desktop app.'
	]);

	recordExampleCases(
		{
			unitId: 'desktop.function.game-authoring-game-preview-game-preview-reading',
			symbol: 'previewSummary',
			state: 'explains-why-the-ai-video-cannot-run',
			evidence: 'examples-cases',
			file: 'explains-why-the-ai-video-cannot-run.json'
		},
		[
			{ name: 'read-only wins over unconfigured', input: inputs[0], output: outputs[0] },
			{ name: 'live AI not configured', input: inputs[1], output: outputs[1] },
			{ name: 'no saved project open', input: inputs[2], output: outputs[2] }
		]
	);
});
