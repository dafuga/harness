import type {
	RawScopeKeys,
	SealedChainEntry,
	SealedDeviceKeys
} from '../../../remote/src/models/networking-security/Sealed.types';

export interface RotationFixture {
	admin: SealedDeviceKeys;
	phone: SealedDeviceKeys;
	keys: RawScopeKeys;
	root: SealedChainEntry;
	enroll: SealedChainEntry;
}
