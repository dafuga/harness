import type { RemoteHostOptions } from '../../../../services/networking-security/remote-host-service/RemoteHostService.types';
import type { RemoteHostStatus } from '../../../../../../remote/src/index';

export interface DesktopRemoteOptions {
	directory: string;
	origin?: string;
	sessionFile: string;
	stores: RemoteHostOptions['shared'];
	onStatus: (status: RemoteHostStatus) => void;
	cancelLocal: () => void;
}
