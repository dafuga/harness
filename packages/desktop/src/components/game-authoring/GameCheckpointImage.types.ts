import type { CheckpointImage } from '../../../../game/src/index';

export type Candidate = { image: CheckpointImage; url: string; guidance: string; stale: boolean };
