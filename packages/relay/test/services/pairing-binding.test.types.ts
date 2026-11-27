import type { TestHost, TestRequest } from '../support/relayActors';
import type { RelaySocket } from '../support/relaySocket';

export interface Own {
	host: TestHost;
	socket: RelaySocket;
	request: TestRequest;
}
