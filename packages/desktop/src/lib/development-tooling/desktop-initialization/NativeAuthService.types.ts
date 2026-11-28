// @harness-uid u_bt6e76o6y5
import type { MacDeviceApprovalService } from './MacDeviceApprovalService';
import type { HostedHttpAdapter } from '../../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import type { NativeSessionAdapter } from '../../../adapters/networking-security/NativeSessionAdapter';
import type { NativeHostedStatus } from '../../../models/projects-sessions/ProjectContext.types';
import type { GoogleBrowserCallbackService } from '../../../services/accounts-access/GoogleBrowserCallbackService';

export interface AuthOptions {
	origin: string;
	http: HostedHttpAdapter;
	store: NativeSessionAdapter;
	deviceApproval?: Pick<MacDeviceApprovalService, 'status' | 'action' | 'close'>;
	open: (url: string) => Promise<void>;
	now?: () => number;
	clearCache?: () => Promise<void>;
	onDisconnect?: () => void;
	onSignIn?: (ownerId: string) => void;
}

export interface Pending {
	callback?: GoogleBrowserCallbackService;
	handoffId: string;
	verifier: string;
	nonce: string;
	resource: string;
	next: number;
	status: NativeHostedStatus;
}

export { NativeSignInError } from '../../../services/accounts-access/NativeSignInError';
