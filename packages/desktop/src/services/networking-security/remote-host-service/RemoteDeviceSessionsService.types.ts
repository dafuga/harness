// @harness-uid u_rdiarfthls
import type { RemoteDeviceAddress } from '../../../../../remote/src/models/networking-security/RemoteRelay.types';
import type {
	DeviceSessionOptions,
	DeviceSessionService
} from './device-session-service/DeviceSessionService';
import type {
	RemoteKeyPair,
	SecurePacket,
	SecureChannelService,
	WireLink
} from '../../../../../remote/src/index';
import type { RemoteHostDevice } from '../../../adapters/networking-security/RemoteHostStoreAdapter';

export type TrackerPhoneFetcher = (url: URL, init: RequestInit) => Promise<Response>;

export interface RemoteDeviceSessionsOptions {
	shared: Omit<
		DeviceSessionOptions,
		'host' | 'device' | 'grant' | 'epoch' | 'trackerPull' | 'trackerPush'
	> & {
		trackerPhone?: string;
		trackerFetcher?: TrackerPhoneFetcher;
		trackerWrite?: { device: string; token: string };
	};
	host: () => { id: string; name: string; keys: RemoteKeyPair; locked?: boolean };
	/** The approved device as stored now, or null once it is revoked. */
	device: (deviceId: string) => RemoteHostDevice | null;
	send: (address: RemoteDeviceAddress, packet: SecurePacket) => void;
	drop: (address: RemoteDeviceAddress, code: number) => void;
}

export interface Entry {
	session: DeviceSessionService;
	generation: number;
	connectionId: string | null;
	channel: SecureChannelService | null;
	link: WireLink | null;
}
