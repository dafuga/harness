// @harness-uid u_c37vr4cyvl
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
	home?: () => Promise<unknown>;
	homeChat?: (input: Fields) => Promise<unknown>;
	homeDocument?: (input: Fields) => Promise<unknown>;
	trackerPull?: (input: Fields) => Promise<unknown>;
	trackerPush?: (input: Fields) => Promise<unknown>;
}

export type Fields = Record<string, unknown>;

export type Operation = (input: unknown) => Promise<unknown>;
