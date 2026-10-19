import type { SecureDirection } from "../models/RemoteSecure.types";

export interface SealContext {
	key: CryptoKey;
	direction: SecureDirection;
	counter: number;
	more: boolean;
}

export { sealPacket, openPacket } from '../services/secure-channel-service/sealPacket';
