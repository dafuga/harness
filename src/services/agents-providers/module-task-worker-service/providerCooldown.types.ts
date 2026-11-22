// @harness-uid u_b4uzqkb2i6
export type ProviderCooldowns = Partial<
	Record<'claude' | 'codex', { until: string; recordedAt: string }>
>;
