import type { WorktreeState } from '../../../../../src/core/activityTypes';

export type Open = { tree: WorktreeState; change: WorktreeState['changes'][number] };
