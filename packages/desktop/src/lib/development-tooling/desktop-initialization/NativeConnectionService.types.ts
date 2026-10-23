import type { CacheStatus } from '../../../models/projects-sessions/ProjectContext.types';
import type { ProjectionCacheService } from './projection-cache-service/ProjectionCacheService';

export interface NativeConnectionOptions {
	origin?: string;
	onCacheStatus?: (status: CacheStatus) => void;
	file: string;
	cache: ProjectionCacheService;
	open: (url: string) => Promise<void>;
}
