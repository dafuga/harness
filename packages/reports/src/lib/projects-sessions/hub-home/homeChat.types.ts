// @harness-uid u_72zuy2swaz
/** What Home sends to the linked computer, and the receipt that comes back. */
export interface HomeChatInput {
	id: string;
	agentId: string;
	itemId: string;
	/** `message` is typed into Chief of Staff's or one live run's prompt; a note is only stored. */
	kind: 'note' | 'answer' | 'message' | 'reminder-done' | 'reminder-snooze';
	question: string | null;
	text: string;
	/** The exact live run a session message is for; Chief of Staff's need none. */
	runId?: string;
	/** A tapped option's 1-based number. The text then carries that option's label. */
	option?: number;
	confirmed?: boolean;
	/** A reminder tap: the armed time the button showed, and for a snooze the new time. */
	armed?: string;
	until?: string;
}

export type HomeChatStatus = 'queued' | 'sent' | 'refused' | 'unconfirmed';

export interface HomeChatReceipt {
	id: string;
	status: HomeChatStatus;
	/** The Tracker id of a stored Hub message. */
	messageId?: string;
}
