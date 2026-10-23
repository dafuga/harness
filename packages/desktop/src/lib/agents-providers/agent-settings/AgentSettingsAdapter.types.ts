export interface AgentSettingsAdapterConfig {
	storage?: Pick<Storage, 'getItem' | 'setItem'>;
}
