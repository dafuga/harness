// @harness-uid u_7cexw2zytg
import type { Writable } from 'node:stream';

export function readFrames(input: AsyncIterable<Buffer>): AsyncGenerator<string>;
export function writeFrame(output: Writable, frame: string): Promise<void>;
export const maxRelayPayloadBytes: number;
export function readFramePayload(frames: AsyncIterator<string>): Promise<string>;
export function writeFramePayload(output: Writable, text: string): Promise<void>;
export function trackerRelayFraming(buffer: typeof Buffer): {
	readFrames: typeof readFrames;
	writeFrame: typeof writeFrame;
	readFramePayload: typeof readFramePayload;
	writeFramePayload: typeof writeFramePayload;
	maxRelayPayloadBytes: typeof maxRelayPayloadBytes;
};
