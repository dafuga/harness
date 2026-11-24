// @harness-uid u_kqcz5yforb
export interface RelayManageAdapterConfig {
	/** The relay's host objects: one per host id. `/manage/*` is reachable through this only. */
	hosts: DurableObjectNamespace;
}

export interface BrowserPairingCall {
	pairingId: string;
	operation: 'poll' | 'exchange';
	proof: { verifier?: unknown };
}

export type Operation =
	| 'register'
	| 'summary'
	| 'revoke-device'
	| 'unregister'
	| 'directory-list'
	| 'pairing-key'
	| 'pairing-request';
