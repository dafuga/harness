// @harness-uid u_rw64iex44n
// @ts-expect-error The shared fixture is an untyped JavaScript module.
import * as framing from '../../../../scripts/tracker-docker-relay/frames.mjs';
import type { DockerTrackerFrames } from './dockerTrackerFrames.types';

export const {
	readFrames,
	writeFramePayload,
	maxRelayPayloadBytes,
	trackerRelayFramingSource
}: DockerTrackerFrames = framing;
