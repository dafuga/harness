// @harness-uid u_rw64iex44n
import { trackerRelayFramingSource } from './dockerTrackerFrames';
import { trackerGuestLauncherSource } from './dockerTrackerGuestLauncher';
import { trackerGuestShimSource } from './dockerTrackerGuestShim';

const frames = `const { readFrames, writeFrame, readFramePayload, writeFramePayload } = ${trackerRelayFramingSource};`;

export function dockerTrackerGuestCommand(
	command: string[],
	itemId: string,
	runId: number
): string[] {
	return [
		'bun',
		'-e',
		frames + '\n' + trackerGuestLauncherSource,
		'--',
		frames + '\n' + trackerGuestShimSource,
		itemId,
		String(runId),
		...command
	];
}
