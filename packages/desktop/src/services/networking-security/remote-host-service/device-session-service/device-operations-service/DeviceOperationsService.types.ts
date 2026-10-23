import type { ClientProjectsService } from '../ClientProjectsService';
import type { ProviderDiscoveryService } from '../../../../agents-providers/provider-discovery-service/ProviderDiscoveryService';
import type { RepositoryArbiterService } from '../../../../projects-sessions/RepositoryArbiterService';
import type { RemoteGrant } from '../../../../../../../remote/src/index';

export interface DeviceOperationsOptions {
	projects: ClientProjectsService;
	providers: ProviderDiscoveryService;
	arbiter: RepositoryArbiterService;
	/** The current grant of the device. Read again for every request. */
	grant: () => RemoteGrant;
}

export type Fields = Record<string, unknown>;

export type Operation = (input: unknown) => Promise<unknown>;
