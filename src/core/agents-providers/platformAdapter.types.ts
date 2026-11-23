// @harness-uid u_lwm3byiwhu
export interface PlatformIdentity {
	workspaceId: string;
	botId: string;
	botUserId: string;
}

export interface PlatformMessage {
	channelId: string;
	text: string;
	threadId?: string;
	blocks?: readonly Readonly<Record<string, unknown>>[];
}

export interface PlatformEvent {
	id: string;
	channelId: string;
	senderId: string;
	text: string;
	messageId: string;
	threadId?: string;
}

export type PlatformFailureCode =
	| 'denied'
	| 'invalid-message'
	| 'credential-unavailable'
	| 'identity-mismatch'
	| 'provider-refused'
	| 'provider-unavailable'
	| 'rate-limited'
	| 'delivery-unknown'
	| 'busy'
	| 'audit-unavailable';

export interface PlatformReceipt {
	channelId: string;
	messageId: string;
}

export type PlatformSendResult = {
	requestId: string;
	auditRecorded: boolean;
} & (
	| { status: 'sent'; receipt: PlatformReceipt }
	| { status: 'refused' | 'unknown'; code: PlatformFailureCode; retryAfterMs?: number }
);

export type PlatformEventHandler = (event: PlatformEvent, signal: AbortSignal) => Promise<void>;

export interface PlatformAdapter {
	identity(): Promise<PlatformIdentity>;
	send(message: PlatformMessage): Promise<PlatformSendResult>;
	subscribe(handler: PlatformEventHandler, signal: AbortSignal): Promise<void>;
}

export type PlatformAuditEvent = {
	platform: string;
	installationId: string;
	workspaceId: string;
	botId: string;
	timestampMs: number;
} & PlatformAuditDetail;

export type PlatformAuditDetail =
	| { kind: 'send-attempt'; requestId: string; channelId?: string }
	| { kind: 'send-retry'; requestId: string; channelId: string; retryAfterMs: number }
	| { kind: 'send-result'; result: PlatformSendResult }
	| { kind: 'receive-attempt' | 'receive-accepted'; eventId: string; channelId: string }
	| { kind: 'receive-reconnect'; reason: 'disconnect' | 'connection-failed' };
