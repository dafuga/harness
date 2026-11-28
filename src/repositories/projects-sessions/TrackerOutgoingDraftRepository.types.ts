// @harness-uid u_4snu2qhejr
export type TrackerOutgoingChannel =
	| 'gmail'
	| 'slack'
	| 'imessage'
	| 'sms'
	| 'telegram'
	| 'github-comment'
	| 'post';

export interface TrackerOutgoingMessage {
	channel: TrackerOutgoingChannel;
	account: string;
	to: string[];
	cc: string[];
	subject?: string;
	thread?: { id: string; label: string; url?: string };
	body: string;
}

export interface NewTrackerOutgoingDraft {
	id: string;
	itemId: string;
	conversationId: string;
	by: string;
	at: number;
	message: TrackerOutgoingMessage;
}

export interface TrackerOutgoingReceipt {
	reference: string;
	url?: string;
}

export interface TrackerOutgoingDraft extends NewTrackerOutgoingDraft {
	revision: number;
	status: 'draft' | 'sent' | 'discarded';
	delivery: 'idle' | 'sending' | 'unconfirmed' | 'failed';
	updatedBy: string;
	updatedAt: number;
	receipt: TrackerOutgoingReceipt | null;
}

export interface TrackerOutgoingRevision {
	id: string;
	revision: number;
	by: string;
	at: number;
}

export type TrackerOutgoingAttempt = TrackerOutgoingRevision & { attempt: string };
export type TrackerOutgoingResult =
	| { kind: 'sent'; receipt: TrackerOutgoingReceipt }
	| { kind: 'failed' | 'unconfirmed' };

export interface TrackerOutgoingDraftRow extends Omit<TrackerOutgoingDraft, 'message' | 'receipt'> {
	message: string;
	receipt: string | null;
}
