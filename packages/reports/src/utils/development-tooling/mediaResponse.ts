function parseRange(range: string) {
	const match = /^bytes=(\d*)-(\d*)$/.exec(range);
	if (!match || (!match[1] && !match[2])) return null;
	const values = match.slice(1).map((value) => (value ? Number(value) : undefined));
	if (values.some((value) => value !== undefined && !Number.isSafeInteger(value))) return null;
	return { first: values[0], last: values[1] };
}
function resolveRange(value: { first?: number; last?: number }, size: number) {
	if (value.first === undefined) {
		const suffix = value.last ?? 0;
		return suffix > 0 ? { start: Math.max(0, size - suffix), end: size - 1 } : null;
	}
	return {
		start: value.first,
		end: value.last === undefined ? size - 1 : Math.min(value.last, size - 1)
	};
}
function byteRange(range: string, size: number) {
	const parsed = parseRange(range);
	if (!parsed) return null;
	const selection = resolveRange(parsed, size);
	if (!selection || selection.start >= size || selection.end < selection.start) return null;
	return selection;
}
export function mediaResponse(
	bytes: Buffer,
	mime: string,
	range?: string | null,
	disposition = 'inline'
) {
	const headers = new Headers({
		'Content-Type': mime,
		'X-Content-Type-Options': 'nosniff',
		'Cache-Control': 'no-store',
		'Content-Disposition': disposition,
		'Accept-Ranges': 'bytes'
	});
	if (!range) {
		headers.set('Content-Length', String(bytes.length));
		return new Response(new Uint8Array(bytes), { headers });
	}
	const selection = byteRange(range, bytes.length);
	if (!selection) {
		headers.set('Content-Range', `bytes */${bytes.length}`);
		return new Response(null, { status: 416, headers });
	}
	const { start, end } = selection;
	headers.set('Content-Range', `bytes ${start}-${end}/${bytes.length}`);
	headers.set('Content-Length', String(end - start + 1));
	return new Response(new Uint8Array(bytes.subarray(start, end + 1)), { status: 206, headers });
}
