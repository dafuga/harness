// @harness-uid u_4yp2jwmhkq
/** Whether a value is a JSON object: not null, not an array, not a scalar. */
export function isRecord<T>(value: T): value is T & Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
