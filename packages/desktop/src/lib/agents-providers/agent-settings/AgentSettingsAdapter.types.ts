// @harness-uid u_2nphyrs2wz
export interface AgentSettingsAdapterConfig {
	storage?: Pick<Storage, 'getItem' | 'setItem'>;
}
