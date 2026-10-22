import type { SecureDirection } from '../../models/networking-security/RemoteSecure.types';

export interface SealContext {
	key: CryptoKey;
	direction: SecureDirection;
	counter: number;
	more: boolean;
}

export {
	sealPacket,
	openPacket
} from '../../services/networking-security/secure-channel-service/sealPacket';
