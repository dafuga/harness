import type { HostedHttpAdapter } from '../../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import type { NativeSessionAdapter } from '../../../adapters/networking-security/NativeSessionAdapter';

export interface StatusOptions {
	http: HostedHttpAdapter;
	store: Pick<NativeSessionAdapter, 'clear'>;
	clearCache?: () => Promise<void>;
	onDisconnect?: () => void;
}
