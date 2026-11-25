// @harness-uid u_j5kk77ld3m
import type {
	ScopeKeys,
	SealedChainEntry,
	SealedDeviceKeys
} from '../../../../remote/src/models/networking-security/Sealed.types';

export interface SealedEnrollment {
	deviceId: string;
	entries: SealedChainEntry[];
	device?: SealedDeviceKeys;
}

export interface SealedObject {
	id: string;
	revision: number;
	envelope: string;
}

export interface SealedObjectPage {
	after: number;
	next: number;
	objects: SealedObject[];
}

export interface StoredGrant {
	scope: string;
	keys: ScopeKeys;
}
