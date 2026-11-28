// @harness-uid u_apuvwehhpw
export interface HomeOutgoingVersion {
	id: string;
	revision: number;
}

export interface HomeOutgoingFields {
	to: string[];
	cc: string[];
	subject?: string;
	body: string;
}

export interface HomeOutgoingDraft extends HomeOutgoingVersion {
	status: 'draft' | 'sent' | 'discarded';
	delivery: 'idle' | 'sending' | 'failed' | 'unconfirmed';
	message: HomeOutgoingFields & {
		channel: 'gmail' | 'slack' | 'imessage' | 'sms' | 'telegram' | 'github-comment' | 'post';
		account: string;
		thread?: { label: string; url?: string };
	};
	receipt?: { url?: string } | null;
	reason?: string;
}

/** The host applies actions and supplies the resulting authoritative records. */
export interface HomeOutgoingActions {
	drafts: readonly HomeOutgoingDraft[];
	send: (version: HomeOutgoingVersion) => void | Promise<void>;
	discard: (version: HomeOutgoingVersion) => void | Promise<void>;
	edit: (version: HomeOutgoingVersion, fields: HomeOutgoingFields) => void | Promise<void>;
}

export interface HomeOutgoingDetail {
	label: string;
	value?: string;
	href?: string;
}
