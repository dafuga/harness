// @harness-uid u_3raczg2p4i
import type {
	PlatformAuditEvent,
	PlatformIdentity
} from '../../core/agents-providers/platformAdapter.types';

export interface SlackInstallation extends PlatformIdentity {
	installationId: string;
	project: string;
	environment: string;
	/** Needed to receive events; a send-only binding may leave it out. */
	appId?: string;
}

export interface SlackCredentialScope extends SlackInstallation {
	purpose: 'bot' | 'socket';
}

/** Implemented by a trusted Vault host. The token stays within the transport callback. */
export interface SlackVaultAccess {
	withToken<T>(
		scope: Readonly<SlackCredentialScope>,
		use: (token: string) => Promise<T>
	): Promise<T>;
}

export interface SlackAdapterConfig {
	installation: SlackInstallation;
	channels: readonly string[];
	receive: 'messages' | 'mentions' | 'none';
	/** Allow replies to authenticated one-to-one DM events, without a static DM list. */
	directMessages?: boolean;
	vault: SlackVaultAccess;
	audit(event: PlatformAuditEvent): Promise<void>;
}
