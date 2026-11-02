// @harness-uid u_rssbwzqpw6
import type { RemoteHostState } from '../../../adapters/networking-security/RemoteHostStoreAdapter';

/** What a registration changes in the record. */
export type RemoteHostEnrolment = Pick<RemoteHostState, 'enabled' | 'origin' | 'generation'>;
