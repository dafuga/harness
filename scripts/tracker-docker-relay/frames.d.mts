// @harness-uid u_2yfuahuo4a
import type { Writable } from 'node:stream';

export function readFrames(input: AsyncIterable<Buffer>): AsyncGenerator<string>;
export function writeFrame(output: Writable, frame: string): Promise<void>;
export const maxRelayPayloadBytes: number;
export function readFramePayload(frames: AsyncIterator<string>): Promise<string>;
export function writeFramePayload(output: Writable, text: string): Promise<void>;
export const trackerRelayFramingSource: string;
