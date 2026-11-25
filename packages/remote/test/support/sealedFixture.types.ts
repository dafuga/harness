import type {
	RawScopeKeys,
	SealedChainEntry,
	SealedChainState,
	SealedDeviceKeys
} from '../../src/models/networking-security/Sealed.types';

/** A small account: phone (admin) made genesis with an account scope and a recovery device. */
export interface SealedAccount {
	phone: SealedDeviceKeys;
	recovery: SealedDeviceKeys;
	scope: RawScopeKeys;
	entries: SealedChainEntry[];
	state: SealedChainState;
}
