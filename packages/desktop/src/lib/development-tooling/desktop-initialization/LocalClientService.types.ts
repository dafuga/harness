import type { ProjectRegistryService } from '../../../services/projects-sessions/ProjectRegistryService';
import type { CommentOutboxService } from '../../../services/projects-sessions/CommentOutboxService';
import type { RepositoryArbiterService } from '../../../services/projects-sessions/RepositoryArbiterService';
import type { ProviderDiscoveryService } from '../../../services/agents-providers/provider-discovery-service/ProviderDiscoveryService';
import type { ImageGenerator } from '../../../models/agents-providers/AgentRunner.types';
import type { ProjectionCacheService } from './projection-cache-service/ProjectionCacheService';
import type { RemoteProjectPort } from '../../../models/projects-sessions/ProjectContext.types';
import type { NativeAuthService } from './NativeAuthService';
import type { LocalControl } from './LocalOperationsService';

export interface LocalClientOptions {
	/** What every client of this computer shares; the session of a window is its own. */
	shared: {
		registry: ProjectRegistryService;
		outbox: CommentOutboxService;
		arbiter: RepositoryArbiterService;
		providers: ProviderDiscoveryService;
		generator: ImageGenerator;
		cache?: ProjectionCacheService;
		remote?: RemoteProjectPort;
		auth?: NativeAuthService;
	};
	choose: () => Promise<string | null>;
	control: LocalControl;
	defer?: (step: () => void) => void;
}
