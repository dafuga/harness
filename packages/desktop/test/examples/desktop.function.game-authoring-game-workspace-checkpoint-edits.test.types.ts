import type { replaceCheckpoint } from '../../src/components/game-authoring/game-workspace/checkpointEdits';

export type Checkpoint = Parameters<typeof replaceCheckpoint>[0][number];
