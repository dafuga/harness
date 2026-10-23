import type { SocketEnd } from './remote-socket-fixture';

export interface Device {
	hash: string;
	end: SocketEnd | null;
	connectionId: string;
}

export interface Address {
	deviceId: string;
	connectionId: string;
}
