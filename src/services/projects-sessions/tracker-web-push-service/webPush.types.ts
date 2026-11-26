// @harness-uid u_flzvrxtaxb
/** One open structured ask, as the notification names it. */
export interface PushAsk {
	itemId: string;
	project: string;
	question: string;
}

/** What survives a restart: which asks were announced, and when the next try may happen. */
export interface PushState {
	sent: string[];
	lastSentAt: number | null;
	holdUntil: number | null;
	failures: number;
	lastError: string | null;
}

export interface PushPlan {
	state: PushState;
	due: boolean;
}

/** `web-push.json`: the application server key pair and the Hub it serves. Mode 0600. */
export interface WebPushConfig {
	version: 1;
	hubOrigin: string;
	publicKey: string;
	privateKey: string;
}

export type PushDelivery = 'delivered' | 'gone' | 'failed';

export type PushFetch = (url: string, init: RequestInit) => Promise<Response>;
