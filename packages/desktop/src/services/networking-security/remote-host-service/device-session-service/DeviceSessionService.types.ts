// @harness-uid u_jfnzmu243b
import type { ClientProjectsOptions } from './ClientProjectsService';
import type { RemoteGrant } from '../../../../../../remote/src/index';

export interface DeviceSessionOptions extends Omit<ClientProjectsOptions, 'emit'> {
	host: { id: string; name: string };
	device: { id: string; name: string };
	grant: () => RemoteGrant;
	trackerPull?: (input: Record<string, unknown>) => Promise<unknown>;
	epoch?: string;
	/** Whether the screen is locked, once the computer knows; undefined until then. */
	locked?: () => boolean | undefined;
}
