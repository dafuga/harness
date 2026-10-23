import type { DeviceCredentials } from './device-pairing-service/DevicePairingService';
import type { AttachInput } from '../../models/networking-security/Remote.types';
import type { WireClientService } from './WireClientService';
import type { SecurePacket } from '../../models/networking-security/RemoteSecure.types';

/** The few things a transport must offer. Text frames only. */
export interface RemoteSocket {
	opened: Promise<void>;
	send(text: string): void;
	close(code?: number): void;
	onMessage(listener: (text: string) => void): void;
	onClose(listener: (code: number) => void): void;
}

export type DeviceStatus = 'online' | 'offline' | 'revoked';

export interface DeviceConnectionOptions {
	credentials: DeviceCredentials;
	client: AttachInput['client'];
	/** Opens the socket with these request headers. The credential is in a header, never the URL. */
	open: (url: string, headers: Record<string, string>) => RemoteSocket;
	handshakeMs?: number;
	wire?: WireClientService;
}

export type Reply = (packet: SecurePacket | null) => void;
