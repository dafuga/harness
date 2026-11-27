import type { canaryTracker } from './needsYouCanaryWorld';

export type CanaryRow = Record<string, unknown> & { id: string; notes: string[] };

export type CanaryWorld = ReturnType<typeof canaryTracker>;
