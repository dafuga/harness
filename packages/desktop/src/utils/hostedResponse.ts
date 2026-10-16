const mebibytes = (limit: number) => (limit === 11534336 ? '11' : '16');

/** Reads every chunk and counts as it goes: the first byte over the limit ends the read. */
async function chunksOf(reader: ReadableStreamDefaultReader<Uint8Array>, limit: number) {
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (let next = await reader.read(); !next.done; next = await reader.read()) {
		size += next.value.length;
		if (size > limit)
			throw new Error(`Hosted answer exceeds ${limit} bytes (${mebibytes(limit)} MiB).`);
		chunks.push(next.value);
	}
	return { chunks, size };
}

function joined(chunks: Uint8Array[], size: number): Uint8Array {
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return bytes;
}

/** Bound the bytes while reading, including responses without Content-Length. */
export async function hostedResponse(response: Response, limit: number): Promise<Uint8Array> {
	const declared = response.headers.get('content-length');
	if (declared && /^\d+$/.test(declared) && Number(declared) > limit) {
		await response.body?.cancel();
		throw new Error(`Hosted answer exceeds ${mebibytes(limit)} MiB.`);
	}
	const reader = response.body?.getReader();
	if (!reader) return new Uint8Array();
	let read: Awaited<ReturnType<typeof chunksOf>>;
	try {
		read = await chunksOf(reader, limit);
	} catch (error) {
		await reader.cancel().catch(() => undefined);
		throw error;
	} finally {
		reader.releaseLock();
	}
	return joined(read.chunks, read.size);
}
