import type { setup } from './devicePairingFixture';

export type Fixture = Awaited<ReturnType<typeof setup>>;
export type State = 'requested' | 'approved' | 'denied' | 'exchanged';
