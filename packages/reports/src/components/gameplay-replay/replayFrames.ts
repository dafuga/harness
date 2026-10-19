import { ReplayFrame } from '../../utils/replayFrames';

export function replayStart(frames: ReplayFrame[]) {
	return Math.max(
		frames.findIndex((frame) => frame.scene !== null),
		0
	);
}
