import type { TestHost } from '../support/relayActors';
import type { TestDevice } from '../support/relayActors';
import type { RelaySocket } from '../support/relaySocket';

export interface Scene {
	host: TestHost;
	socket: RelaySocket;
	device: TestDevice;
	phone: RelaySocket;
	connectionId: string;
}
