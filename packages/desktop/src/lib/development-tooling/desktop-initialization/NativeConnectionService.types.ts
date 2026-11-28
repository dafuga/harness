// @harness-uid u_u5rrzn7a6a
import type { CacheStatus } from '../../../models/projects-sessions/ProjectContext.types';
import type { ProjectionCacheService } from './projection-cache-service/ProjectionCacheService';

export interface NativeConnectionOptions {
	origin?: string;
	deviceApprovalBinary?: string;
	onCacheStatus?: (status: CacheStatus) => void;
	file: string;
	cache: ProjectionCacheService;
	onSignIn?: (ownerId: string) => void;
	onDisconnect?: () => void;
	open: (url: string) => Promise<void>;
}
