import type { ClientProjectsOptions } from './ClientProjectsService';
import type { RemoteGrant } from '../../../../../../remote/src/index';

export interface DeviceSessionOptions extends Omit<ClientProjectsOptions, 'emit'> {
	host: { id: string; name: string };
	device: { id: string; name: string };
	grant: () => RemoteGrant;
	epoch?: string;
	/** Whether the screen is locked, once the computer knows; undefined until then. */
	locked?: () => boolean | undefined;
}
