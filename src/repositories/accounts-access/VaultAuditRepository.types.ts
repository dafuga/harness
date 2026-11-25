// @harness-uid u_hgig2hgaul

export type VaultAuditEventName =
	| 'request'
	| 'approval'
	| 'denial'
	| 'delivery'
	| 'password-start'
	| 'password-complete'
	| 'password-failed'
	| 'expiry'
	| 'revoke'
	| 'lease'
	| 'attach'
	| 'lease-end';

/** Every field the journal may hold; all are identifiers, digests or enums, never secrets. */
export interface VaultAuditFields {
	request: string;
	item: string;
	site: string;
	action: string;
	method: 'api-token' | 'oauth-device' | 'browser';
	recipeDigest: string;
	host: string;
	lease?: string;
	cause?: string;
}

export interface VaultAuditEvent extends VaultAuditFields {
	event: VaultAuditEventName;
	time: string;
}
