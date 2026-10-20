import type { CacheStatus } from '../../models/ProjectContext.types';
import { NativeSessionAdapter, type NativeEncryption } from '../../adapters/NativeSessionAdapter';
import { HostedHttpAdapter } from '../../adapters/hosted-http-adapter/HostedHttpAdapter';
import { RemoteHttpProjectAdapter } from './remote-http-project-adapter/RemoteHttpProjectAdapter';
import { NativeAuthService } from './NativeAuthService';
import type { ProjectionCacheService } from './projection-cache-service/ProjectionCacheService';
interface NativeConnectionOptions {
	origin?: string;
	onCacheStatus?: (status: CacheStatus) => void;
	file: string;
	cache: ProjectionCacheService;
	open: (url: string) => Promise<void>;
}
export class NativeConnectionService {
	create(options: NativeConnectionOptions, encryption: NativeEncryption) {
		if (!options.origin) return {};
		const origin = new URL(options.origin).origin;
		const store = new NativeSessionAdapter(options.file, encryption);
		const transport = {
			origin: options.origin,
			credentials: () => store.read(),
			authorityVersion: () => store.generation
		};
		const http = new HostedHttpAdapter(transport);
		return {
			remote: new RemoteHttpProjectAdapter({
				...transport,
				cache: options.cache,
				onCacheStatus: options.onCacheStatus
			}),
			auth: new NativeAuthService({
				origin,
				http,
				store,
				open: options.open,
				clearCache: () => options.cache.clear(),
				onDisconnect: () => {
					store.invalidate();
					options.onCacheStatus?.({ projectId: '$projects', status: 'denied' });
				}
			})
		};
	}
}
