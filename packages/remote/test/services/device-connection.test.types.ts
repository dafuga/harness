import type { hostPeer } from '../support/hostPeer';

export type Peer = Awaited<ReturnType<typeof hostPeer>>;
