import type { SealedChainEntry } from '../../../../../remote/src/models/networking-security/Sealed.types';
import type { Grant } from './syncGrants.types';

export interface BootstrapState {
	entry: SealedChainEntry;
	hash: string;
	recovery: string;
	grants: Grant[];
}
