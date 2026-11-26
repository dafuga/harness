// @harness-uid u_hsyfpu5tqc
/** Chief of Staff's own pane, or one exact Tracker run: never "whichever session is there now". */
export type HubMessageTarget = { kind: 'cos' } | { kind: 'run'; node: string; runId: number };

export type HubMessageEvent =
	| { type: 'message'; id: string; target: HubMessageTarget; text: string }
	| { type: 'delivered'; id: string; session: string }
	| { type: 'refused'; id: string; reason: string }
	| { type: 'reply'; id: string; text: string };

/**
 * `stored`: the Tracker holds it. `delivered`: typed into the session's prompt and seen submitted.
 * `acknowledged`: the session answered it. `refused`: it will never be delivered.
 */
export type HubMessageStatus = 'stored' | 'delivered' | 'acknowledged' | 'refused';

export interface HubThreadNote {
	at: string;
	text: string;
}

export interface HubThreadMessage {
	id: string;
	target: HubMessageTarget;
	text: string;
	at: string;
	status: HubMessageStatus;
	session?: string;
	deliveredAt?: string;
	reason?: string;
	replies: { text: string; at: string }[];
}
