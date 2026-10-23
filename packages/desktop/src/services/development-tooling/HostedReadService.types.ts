import type { RemoteHttpOptions } from '../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import type { ProjectionCacheService } from '../../lib/development-tooling/desktop-initialization/projection-cache-service/ProjectionCacheService';
import type { CacheStatus } from '../../models/projects-sessions/ProjectContext.types';

export interface HostedReadOptions extends RemoteHttpOptions {
	cache?: ProjectionCacheService;
	onCacheStatus?: (status: CacheStatus) => void;
}

/** One read: whose it is, where it is kept, and the check that its authority still stands. */
export interface ReadContext {
	scope: string;
	principalId: string;
	projectId: string;
	guard: () => Promise<void>;
}
