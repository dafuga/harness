/** Immutable Git text is shared across trees, with an explicit 64 MiB retained-byte bound. */
const limit = 64 * 1024 * 1024;
const texts = new Map<string, { text: string; bytes: number }>();
let retained = 0;

export function cachedBlobText(key: string): string | undefined {
	const known = texts.get(key);
	if (!known) return undefined;
	texts.delete(key);
	texts.set(key, known);
	return known.text;
}

export function keepBlobText(key: string, text: string): void {
	const bytes = Buffer.byteLength(text);
	if (bytes > limit) return;
	const prior = texts.get(key);
	if (prior) retained -= prior.bytes;
	texts.delete(key);
	texts.set(key, { text, bytes });
	retained += bytes;
	while (retained > limit) {
		const first = texts.entries().next().value!;
		retained -= first[1].bytes;
		texts.delete(first[0]);
	}
}
