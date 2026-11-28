// @harness-uid u_56mpqyme4j
import type { PushQuietHours } from '../../../../../src/utils/projects-sessions/webPushContract.types';

export type { PushQuietHours };

/** `GET /api/push`. A browser is named by the hash of its push address, never the address. */
export interface HubPushSettings {
	available: boolean;
	publicKey: string;
	quiet: PushQuietHours;
	browsers: { id: string; deliveredAt: number | null }[];
}

export type HubPushDevice = 'on' | 'off' | 'blocked' | 'install' | 'unsupported';

export interface HubPushReading {
	device: HubPushDevice;
	settings: HubPushSettings;
	/** This browser's last delivered notification, when it has had one. */
	deliveredAt: number | null;
}

export type ApprovalPushRequest = (
	method: 'GET' | 'POST' | 'DELETE',
	subscription?: PushSubscriptionJSON
) => Promise<Response>;

export interface HubApprovalPushReading {
	device: HubPushDevice;
	publicKey: string;
}
