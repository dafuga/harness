/** Tracker's API defaults empty strings, false and zero as well as missing input. */
export function trackerItemValueOr<Value, Fallback>(
	value: Value,
	fallback: Fallback
): NonNullable<Value> | Fallback {
	if (value) return value;
	return fallback;
}
