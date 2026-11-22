// @harness-uid u_euoiys4fni

export interface VaultBrokerClientConfig {
	/** Absolute path of the broker's Unix socket. */
	socketPath: string;
	timeoutMs?: number;
}
