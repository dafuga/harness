// @harness-uid u_rw64iex44n
import type { Writable } from 'node:stream';

export interface DockerTrackerFrames {
	readFrames(input: AsyncIterable<Buffer>): AsyncGenerator<string>;
	writeFramePayload(output: Writable, text: string): Promise<void>;
	maxRelayPayloadBytes: number;
	trackerRelayFramingSource: string;
}
