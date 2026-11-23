// @harness-uid u_xhueog5n2u
export interface PhoneReplicaWriteGrant {
	device: string;
	token: string;
}

export interface PhoneReplicaIntent {
	intentId: string;
	itemId: string;
	action: 'note' | 'flag' | 'answer';
	text: string;
	revision: string | null;
}

export type PhoneReplicaReceipt = { intentId: string } & (
	| { status: 'accepted' }
	| { status: 'conflict'; reason: 'item' | 'attention' | 'intent' | 'duplicate' }
);
