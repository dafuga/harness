// @harness-uid u_u5rrzn7a6a
import type { NativeConnectionOptions } from './NativeConnectionService.types';
import {
	NativeSessionAdapter,
	type NativeEncryption
} from '../../../adapters/networking-security/NativeSessionAdapter';
import { HostedHttpAdapter } from '../../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import { RemoteHttpProjectAdapter } from './remote-http-project-adapter/RemoteHttpProjectAdapter';
import { MacDeviceApprovalService } from './MacDeviceApprovalService';
import { NativeAuthService } from './NativeAuthService';
import type { TrackerOverviewAuthority } from './tracker-overview-publisher/TrackerOverviewPublisher.types';

/** The owner-only Hub endpoint the background publisher writes; only the native bearer may use it. */
const TRACKER_OVERVIEW_PATH = '/api/tracker-overview';

/** The publisher's view of the main-process session: verified owner, its version, and one PUT. */
function overviewAuthority(
	http: HostedHttpAdapter,
	store: NativeSessionAdapter
): TrackerOverviewAuthority {
	return {
		authorize: () => http.authorize(),
		version: () => store.generation,
		put: (credential, body) =>
			http.request(TRACKER_OVERVIEW_PATH, credential, { method: 'PUT', body }).then(() => undefined)
	};
}

function endConnection(options: NativeConnectionOptions, store: NativeSessionAdapter): () => void {
	return () => {
		store.invalidate();
		options.onDisconnect?.();
		options.onCacheStatus?.({ projectId: '$projects', status: 'denied' });
	};
}

export class NativeConnectionService {
	create(options: NativeConnectionOptions, encryption: NativeEncryption) {
		if (!options.origin) return {};
		const origin = new URL(options.origin).origin;
		const store = new NativeSessionAdapter(options.file, encryption);
		const deviceApproval = options.deviceApprovalBinary
			? new MacDeviceApprovalService(options.deviceApprovalBinary)
			: undefined;
		let auth: NativeAuthService;
		const transport = {
			origin: options.origin,
			credentials: () => (deviceApproval && !auth.admitted ? Promise.resolve(null) : store.read()),
			authorityVersion: () => store.generation
		};
		const http = new HostedHttpAdapter(transport);
		auth = new NativeAuthService({
			origin,
			http,
			store,
			deviceApproval,
			open: options.open,
			onSignIn: options.onSignIn,
			clearCache: () => options.cache.clear(),
			onDisconnect: endConnection(options, store)
		});
		return {
			authority: overviewAuthority(http, store),
			remote: new RemoteHttpProjectAdapter({
				...transport,
				cache: options.cache,
				onCacheStatus: options.onCacheStatus
			}),
			auth
		};
	}
}
