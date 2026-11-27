// @harness-uid u_vusx2wyapy
import type { SessionRecord } from '../../../../models/accounts-access/HubAuthStore.types';
import type { HubRemoteRuntime } from '../../../../utils/networking-security/hubRemote';

export interface Route {
	kind:
		| 'hosts'
		| 'host'
		| 'device'
		| 'pairing'
		| 'browser-socket'
		| 'browser-poll'
		| 'browser-exchange';
	ids: string[];
}

export interface Call {
	request: Request;
	remote: HubRemoteRuntime;
	/** Always the verified session actor. Nothing a request carries names the owner. */
	owner: { id: string };
	session?: Pick<SessionRecord, 'kind' | 'idHash'> | null;
	ids: string[];
}
