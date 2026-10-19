import type { RelayManageAdapter } from '../adapters/RelayManageAdapter';

export interface HubRemoteRuntime {
	/** The exact relay origin a registering host is told to connect to. */
	origin: string;
	relay: RelayManageAdapter;
}

export { hubRemote } from '../routes/api/[...path]/hubRemote';
