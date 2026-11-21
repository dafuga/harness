// @harness-uid u_rw64iex44n
// Bun inlines these source files in both the standalone and packaged CLI builds.
import { trackerRelayFraming } from '../../../../scripts/tracker-docker-relay/frames.mjs';
// @ts-expect-error This source is imported via Bun's text loader.
import launcher from './dockerTrackerGuestLauncher.mjs' with { type: 'text' };
// @ts-expect-error This source is imported via Bun's text loader.
import shim from './dockerTrackerGuestShim.mjs' with { type: 'text' };

const frames = `const { readFrames, writeFrame, readFramePayload, writeFramePayload } = (${trackerRelayFraming})(Buffer);`;

export function dockerTrackerGuestCommand(
	command: string[],
	itemId: string,
	runId: number
): string[] {
	return [
		'bun',
		'-e',
		frames + '\n' + launcher,
		'--',
		frames + '\n' + shim,
		itemId,
		String(runId),
		...command
	];
}
