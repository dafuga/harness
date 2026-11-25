// @harness-uid u_xhueog5n2u
export interface PhoneReplicaWriteGrant {
	device: string;
	token: string;
}

import type { PhoneReplicaAction } from './phoneReplicaActions.types';

export interface PhoneReplicaIntent {
	intentId: string;
	itemId: string;
	action: PhoneReplicaAction;
	text: string;
	revision: string | null;
	expectedStatus: string | null;
	/** The tapped option's 1-based number, or null for a free-text write. */
	option: number | null;
	confirmed: boolean;
}

export type PhoneReplicaReceipt = { intentId: string } & (
	| { status: 'accepted' }
	| { status: 'conflict'; reason: 'item' | 'attention' | 'intent' | 'duplicate' }
);
