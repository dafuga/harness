// @harness-uid u_k4rxbz6pq3
import { hubFail } from '../../../utils/development-tooling/hubJson';

/** The whole request body, counted as bytes on the wire. Checked before any parsing. */
export const MAX_BODY_BYTES = 256 * 1024;

/** Reads the body, refusing as soon as it passes the byte limit. Only a JSON body is accepted. */
export async function readOverviewText(
	request: Request,
	maximum: number = MAX_BODY_BYTES
): Promise<string> {
	assertJsonLength(request, maximum);
	const reader = request.body?.getReader();
	if (!reader) return invalid();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (let part = await reader.read(); !part.done; part = await reader.read()) {
		size += part.value.byteLength;
		if (size > maximum) {
			await reader.cancel();
			tooLarge();
		}
		chunks.push(part.value);
	}
	return decode(chunks, size);
}

function assertJsonLength(request: Request, maximum: number) {
	if (!request.headers.get('Content-Type')?.startsWith('application/json')) invalid();
	const declared = request.headers.get('Content-Length');
	if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximum)) tooLarge();
}

function decode(chunks: Uint8Array[], size: number): string {
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const part of chunks) {
		bytes.set(part, offset);
		offset += part.byteLength;
	}
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return invalid();
	}
}

function invalid(): never {
	return hubFail('invalid-input');
}

function tooLarge(): never {
	return hubFail('artifact-too-large');
}
