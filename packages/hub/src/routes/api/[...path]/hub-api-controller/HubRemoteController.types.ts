import type { HubRemoteRuntime } from '../../../../utils/networking-security/hubRemote';

export interface Route {
	kind: 'hosts' | 'host' | 'device';
	ids: string[];
}

export interface Call {
	request: Request;
	remote: HubRemoteRuntime;
	/** Always the verified session actor. Nothing a request carries names the owner. */
	owner: { id: string };
	ids: string[];
}
