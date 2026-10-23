import { bytesText, concatBytes } from '../../../../remote/src/index';
import { relayConfig } from '../../configs/networking-security/relayConfig';
import { isRecord } from './isRecord';

/**
 * A JSON object of at most `relayConfig.bodyBytes`, or nothing. The body is read chunk by chunk
 * and abandoned at the first byte over the limit. Only an internal caller passes `typed = false`:
 * a public body has to say that it is JSON.
 */
export async function readJsonBody(
	request: Request,
	typed = true
): Promise<Record<string, unknown> | undefined> {
	if (typed && !isJson(request.headers.get('Content-Type'))) return undefined;
	if (Number(request.headers.get('Content-Length') ?? 0) > relayConfig.bodyBytes) return undefined;
	const bytes = await boundedBytes(request.body, relayConfig.bodyBytes);
	if (!bytes) return undefined;
	try {
		const value: unknown = JSON.parse(bytesText(bytes));
		return isRecord(value) ? value : undefined;
	} catch {
		return undefined;
	}
}

function isJson(type: string | null): boolean {
	return (type ?? '').split(';')[0].trim().toLowerCase() === 'application/json';
}

async function boundedBytes(
	body: ReadableStream<Uint8Array> | null,
	limit: number
): Promise<Uint8Array | undefined> {
	if (!body) return undefined;
	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) return concatBytes(...chunks);
		size += value.byteLength;
		if (size > limit) {
			await reader.cancel();
			return undefined;
		}
		chunks.push(value);
	}
}
