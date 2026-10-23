export type Ask = <T>(
	method: 'evidence' | 'artifact',
	input: Record<string, unknown>
) => Promise<T>;
