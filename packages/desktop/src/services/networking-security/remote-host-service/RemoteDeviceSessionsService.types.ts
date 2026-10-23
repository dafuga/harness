import type { DeviceSessionOptions } from './device-session-service/DeviceSessionService';
import type { DeviceSessionService } from './device-session-service/DeviceSessionService';
import type { RemoteKeyPair } from '../../../../../remote/src/index';
import type { SecurePacket } from '../../../../../remote/src/index';
import type { SecureChannelService } from '../../../../../remote/src/index';
import type { WireLink } from '../../../../../remote/src/index';
import type { RemoteHostDevice } from '../../../adapters/networking-security/RemoteHostStoreAdapter';

export interface DeviceAddress {
	deviceId: string;
	connectionId: string;
}

export interface RemoteDeviceSessionsOptions {
	shared: Omit<DeviceSessionOptions, 'host' | 'device' | 'grant' | 'epoch'>;
	host: () => { id: string; name: string; keys: RemoteKeyPair; locked?: boolean };
	/** The approved device as stored now, or null once it is revoked. */
	device: (deviceId: string) => RemoteHostDevice | null;
	send: (address: DeviceAddress, packet: SecurePacket) => void;
	drop: (address: DeviceAddress, code: number) => void;
}

export interface Entry {
	session: DeviceSessionService;
	generation: number;
	connectionId: string | null;
	channel: SecureChannelService | null;
	link: WireLink | null;
}
