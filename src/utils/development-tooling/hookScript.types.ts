import type { hookStages } from './hookScript';

export type HookStage = (typeof hookStages)[number];
