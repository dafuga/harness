/** An HTTP byte range expressed as an offset and length for R2. */
export function deliveryRange(header: string, size: number) {
	const match = /^bytes=(\d*)-(\d*)$/.exec(header);
	if (!match || size <= 0 || (!match[1] && !match[2])) return null;
	const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
	const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
	if (!Number.isSafeInteger(start) || start >= size || end < start) return null;
	return { offset: start, length: end - start + 1 };
}
