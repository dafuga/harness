import type { startChainTracker } from './chainTracker';

export type ChainTracker = Awaited<ReturnType<typeof startChainTracker>>;
