export function recordValue(value: unknown): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Invalid Jev response');
	return value as Record<string, unknown>;
}

export function probabilityValue(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)
		throw new Error('Invalid Jev probability');
	return value;
}

export function tokenCount(value: unknown): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
		throw new Error('Invalid Jev usage');
	return value;
}
