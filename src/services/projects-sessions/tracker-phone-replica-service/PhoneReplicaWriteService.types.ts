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
}

export type PhoneReplicaReceipt = { intentId: string } & (
	| { status: 'accepted' }
	| { status: 'conflict'; reason: 'item' | 'attention' | 'intent' | 'duplicate' }
);
