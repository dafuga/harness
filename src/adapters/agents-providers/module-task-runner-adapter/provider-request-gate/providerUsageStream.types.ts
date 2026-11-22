// @harness-uid u_rw64iex44n
export interface ProviderUsageFrame {
	type?: string;
	usage?: Record<string, number>;
	message?: { usage?: Record<string, number> };
	response?: { usage?: Record<string, number> };
}
