import type {
	RawScopeKeys,
	ScopeKeys,
	SealedDeviceKeys
} from '../src/models/networking-security/Sealed.types';

/** The phone-made account of the zero-plaintext scenario. */
export interface Account {
	phone: SealedDeviceKeys;
	recovery: SealedDeviceKeys;
	accountScope: RawScopeKeys;
	scope: string;
	phoneKeys: ScopeKeys;
}

/** The enrolled Mac and its account scope keys. */
export interface MacSession {
	mac: SealedDeviceKeys;
	macKeys: ScopeKeys;
}
