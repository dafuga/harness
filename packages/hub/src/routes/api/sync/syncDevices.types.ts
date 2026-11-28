import type { SealedChainEntry } from '../../../../../remote/src/models/networking-security/Sealed.types';
import type { Grant } from './syncGrants.types';

export interface DeviceChange {
	entries: SealedChainEntry[];
	grants: Grant[];
	enrollment?: string;
}
