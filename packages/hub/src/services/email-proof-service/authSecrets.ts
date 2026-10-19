

/**
 * Eight decimal digits, drawn without modulo bias. Eight, not six: a person who still holds a
 * Google account for an address they lost can ask for new codes every day.
 */
export function emailCode(): string {
	const draw = new Uint32Array(1);
	do crypto.getRandomValues(draw);
	while (draw[0] >= 4_200_000_000);
	return String(draw[0] % 100_000_000).padStart(8, '0');
}
