import type { TestDevice } from '../support/relayActors';
import type { RelaySocket } from '../support/relaySocket';

export interface Phone {
	device: TestDevice;
	socket: RelaySocket;
	connectionId: string;
}

export interface Address {
	deviceId: string;
	connectionId: string;
}
