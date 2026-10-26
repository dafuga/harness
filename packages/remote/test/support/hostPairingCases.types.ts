import type { HostPairingOffer } from '../../src/services/host-pairing-service/HostPairingService';
import type { setup, reaches } from './hostPairingCases';
export type Setup = Awaited<ReturnType<typeof setup>>;
export type Offer = HostPairingOffer;
export type Ctx = { f: Setup; offer: Offer | null; framed?: Awaited<ReturnType<Setup['frame']>> };
export type State = keyof typeof reaches;

export type PairingOverrides = Record<string, unknown>;
