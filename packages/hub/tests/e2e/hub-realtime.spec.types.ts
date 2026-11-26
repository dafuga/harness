import type { startChain } from './hub-realtime-chain';

export type Chain = Awaited<ReturnType<typeof startChain>>;
