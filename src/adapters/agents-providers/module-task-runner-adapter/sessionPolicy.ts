// @harness-uid u_rw64iex44n
export const defaultContextTokens = 150_000;
export const hardContextTokens = 190_000;
export const providerCompactionTokens = 170_000;
export const contextPollMs = 200;
export const telemetryTimeoutMs = 120_000;

export function contextThreshold(value: number): number {
	if (!Number.isSafeInteger(value) || value <= 0 || value > defaultContextTokens)
		throw new Error('Context threshold must be an integer between 1 and 150000.');
	return value;
}
