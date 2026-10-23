import type { ProjectRegistryService } from '../../../projects-sessions/ProjectRegistryService';
import type { CommentOutboxService } from '../../../projects-sessions/CommentOutboxService';
import type { RepositoryArbiterService } from '../../../projects-sessions/RepositoryArbiterService';
import type { ProviderDiscoveryService } from '../../../agents-providers/provider-discovery-service/ProviderDiscoveryService';
import type { ImageGenerator } from '../../../../models/agents-providers/AgentRunner.types';
import type { RunEvent } from '../../../../models/development-tooling/DesktopBridge.types';
import type { DesktopBridge } from '../../../../models/development-tooling/DesktopBridge.types';
import type { ProjectionCacheService } from '../../../../lib/development-tooling/desktop-initialization/projection-cache-service/ProjectionCacheService';
import type { ProjectSessionService } from '../../../projects-sessions/project-session-service/ProjectSessionService';
import type { DesktopRunService } from '../../../agents-providers/desktop-run-service/DesktopRunService';

export interface ClientProjectsOptions {
	registry: ProjectRegistryService;
	outbox: CommentOutboxService;
	arbiter: RepositoryArbiterService;
	providers: ProviderDiscoveryService;
	generator: ImageGenerator;
	/** Run events of this client and of nobody else. */
	emit: (event: RunEvent) => void;
	cache?: ProjectionCacheService;
}

export interface ClientProject {
	id: string;
	root: string;
	session: ProjectSessionService;
	runs: DesktopRunService;
	bridge: Omit<DesktopBridge, 'onRunEvent'>;
}
