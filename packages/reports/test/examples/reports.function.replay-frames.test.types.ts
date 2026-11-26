import type { replayFrames } from '../../src/utils/reports-media/replayFrames';

export type Items = Parameters<typeof replayFrames>[0];

export type Item = Items[number];
