import type { PushSubscriptionTarget } from '../../../../../../src/utils/projects-sessions/webPushContract.types';
import type { PushDelivery } from '../../../../../../src/services/projects-sessions/tracker-web-push-service/webPush.types';

export interface ApprovalPush {
	web?: WebApprovalPush;
	apns?: ApnsApprovalPush;
	schedule?: (work: Promise<void>) => void;
}

export interface WebApprovalPush {
	publicKey: string;
	deliver: (target: PushSubscriptionTarget) => Promise<PushDelivery>;
}

export interface ApnsApprovalPush {
	deliver: (token: string) => Promise<PushDelivery>;
}

export interface ApprovalDeviceRow {
	device: string;
	session_hash: string;
}

export interface ApprovalPushRow extends ApprovalDeviceRow {
	endpoint: string;
	p256dh: string;
	auth: string;
}

export interface ApprovalApnsRow extends ApprovalDeviceRow {
	token: string;
}

export type ApprovalPushTable = 'approval_web_push' | 'approval_apns';
