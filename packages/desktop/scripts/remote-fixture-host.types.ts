import type { startRelay } from '../../relay/test/support/relayFixture';
import type { RemoteHostService } from '../src/services/networking-security/remote-host-service/RemoteHostService';

export interface RemoteFixtureOptions {
	/** Fixed ports for a simulator to be pointed at; any free ones when 0 or omitted. */
	relayPort?: number;
	controlPort?: number;
	/** Where public facts of the fixture are written: addresses and ids, never a code or a key. */
	publicDirectory: string;
	log: (line: string) => void;
	/**
	 * Who approves a phone that asks. By default the fixture does, as it has no person at it;
	 * `asked` leaves every request waiting until the control is told to approve or deny it.
	 */
	approval?: 'automatic' | 'asked';
}

export type Relay = Awaited<ReturnType<typeof startRelay>>;

export interface Running {
	host: RemoteHostService;
	screen: { locked?: boolean };
	facts: { relayOrigin: string; hostId: string; project: { id: string; name: string } };
}
