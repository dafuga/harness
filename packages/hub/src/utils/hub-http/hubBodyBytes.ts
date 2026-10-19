import { hubFail } from "../hubJson";

export async function hubBodyBytes(request: Request): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [],
		reader = request.body?.getReader();
	if (!reader) return hubFail('invalid-input');
	let size = 0;
	while (true) {
		const part = await reader.read();
		if (part.done) break;
		size += part.value.byteLength;
		if (size > 20000) {
			await reader.cancel();
			return hubFail('invalid-input');
		}
		chunks.push(part.value);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	chunks.forEach((part) => {
		bytes.set(part, offset);
		offset += part.byteLength;
	});
	return bytes;
}
