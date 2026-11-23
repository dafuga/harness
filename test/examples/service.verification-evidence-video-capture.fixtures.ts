import type {
	VideoCapturePlan,
	VideoCaptureScriptInput
} from '../../src/services/verification-evidence/VideoCaptureService.types';

export function scriptFixture(): { input: VideoCaptureScriptInput; plan: VideoCapturePlan } {
	const slot = { unit: 'unit.a', clipId: 'clip-a', viewport: 'desktop', inputHash: 'c'.repeat(64) };
	const clip = {
		id: 'clip-a',
		unit: 'unit.a',
		entry: 'start',
		exit: 'done',
		state: 'editing',
		states: ['start', 'editing', 'done'],
		edges: []
	};
	const input = {
		clip,
		slot,
		viewport: { id: 'desktop', width: 1280, height: 720 },
		pendingFlags: [{ id: 'flag-1', note: 'Check the focus ring' }]
	} as unknown as VideoCaptureScriptInput;
	const plan = {
		known: [
			{
				id: 'flag-1',
				unit: 'unit.a',
				clipId: 'clip-a',
				viewport: 'desktop',
				createdAt: '2026-11-16T00:00:00.000Z'
			}
		]
	} as unknown as VideoCapturePlan;
	return { input, plan };
}
