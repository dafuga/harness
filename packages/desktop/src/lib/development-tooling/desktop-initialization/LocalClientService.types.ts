// @harness-uid u_u3ui3ii2hx
import type { ProjectRegistryService } from '../../../services/projects-sessions/ProjectRegistryService';
import type { CommentOutboxService } from '../../../services/projects-sessions/CommentOutboxService';
import type { RepositoryArbiterService } from '../../../services/projects-sessions/RepositoryArbiterService';
import type { ProviderDiscoveryService } from '../../../services/agents-providers/provider-discovery-service/ProviderDiscoveryService';
import type { RenderMockups } from '../../../utils/planning-collaboration/mockupSource.types';
import type { ProjectionCacheService } from './projection-cache-service/ProjectionCacheService';
import type { RemoteProjectPort } from '../../../models/projects-sessions/ProjectContext.types';
import type { NativeAuthService } from './NativeAuthService';
import type { LocalControl, LocalOperationsOptions } from './LocalOperationsService.types';

export interface LocalClientOptions {
	/** What every client of this computer shares; the session of a window is its own. */
	shared: {
		registry: ProjectRegistryService;
		outbox: CommentOutboxService;
		arbiter: RepositoryArbiterService;
		providers: ProviderDiscoveryService;
		renderMockups?: RenderMockups;
		cache?: ProjectionCacheService;
		remote?: RemoteProjectPort;
		auth?: NativeAuthService;
		home?: LocalOperationsOptions['home'];
		homeChat?: LocalOperationsOptions['homeChat'];
	};
	accountRequired?: boolean;
	choose: () => Promise<string | null>;
	control: LocalControl;
	defer?: (step: () => void) => void;
}
