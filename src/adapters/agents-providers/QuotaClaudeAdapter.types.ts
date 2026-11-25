export interface QuotaClaudeAdapterConfig {
	readUsage?: () => Promise<string>;
}
