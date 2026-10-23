export interface RelayManageAdapterConfig {
	/** The relay's host objects: one per host id. `/manage/*` is reachable through this only. */
	hosts: DurableObjectNamespace;
}

export type Operation = 'register' | 'summary' | 'revoke-device' | 'unregister';
