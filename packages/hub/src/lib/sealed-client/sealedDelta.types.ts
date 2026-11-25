// @harness-uid u_cx2e2nfvja
import type {
	SealedChainEntry,
	SealedChainState,
	SealedGrant
} from '../../../../remote/src/models/networking-security/Sealed.types';

export interface ChainPage {
	entries: SealedChainEntry[];
	more: boolean;
}

export interface ObjectChange {
	id: string;
	revision: number;
	change: number;
}

export interface ObjectChanges {
	objects: ObjectChange[];
	next: number;
	more: boolean;
}

export interface GrantList {
	grants: SealedGrant[];
}

import type { SealedEnrollment } from './SealedBrowserCache.types';

export interface RefreshedEnrollment {
	enrollment: SealedEnrollment;
	chain: SealedChainState;
	keysChanged: boolean;
}
