import type { SealedChainEntry } from '../../../remote/src/models/networking-security/Sealed.types';
import type { SealedObject } from '../../src/lib/sealed-client/SealedBrowserCache.types';

export interface SeedCache {
	account: string;
	scope: string;
	keys: { scopeId: number[]; commitment: number[] };
	dataKey: number[];
	indexKey: number[];
	entry: SealedChainEntry;
	deviceId: string;
	objects: SealedObject[];
}
