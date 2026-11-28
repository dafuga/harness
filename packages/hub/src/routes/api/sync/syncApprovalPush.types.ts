import type { PushSubscriptionTarget } from '../../../../../../src/utils/projects-sessions/webPushContract.types';
import type { PushDelivery } from '../../../../../../src/services/projects-sessions/tracker-web-push-service/webPush.types';

export interface ApprovalPush {
	publicKey: string;
	deliver: (target: PushSubscriptionTarget) => Promise<PushDelivery>;
	schedule?: (work: Promise<void>) => void;
}

export interface ApprovalPushRow {
	device: string;
	session_hash: string;
	endpoint: string;
	p256dh: string;
	auth: string;
}
