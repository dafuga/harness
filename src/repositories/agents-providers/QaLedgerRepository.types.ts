// @harness-uid u_kg5hqz6vwx
export type QaLedgerLine =
	| { kind: 'reserved'; eventId: string; issue: number; at: string }
	| {
			kind: 'posted';
			eventId: string;
			issue: number;
			channelId: string;
			parentTs: string;
			at: string;
	  };
