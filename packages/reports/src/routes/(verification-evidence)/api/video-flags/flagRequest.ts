// @harness-uid u_udyzin5pcn
import { json } from '@sveltejs/kit';
import { inputSchema } from '../../../../../../../src/services/verification-evidence/frame-flag-service/flagSchema';
import type { FrameFlagInput } from '../../../../../../../src/services/verification-evidence/FrameFlagService.types';

const bodyLimit = 8192;

/** Reject before body access; enforce the same limit on streamed or absent length headers. */
export async function readFlagRequest(
	request: Request,
	origin: string
): Promise<FrameFlagInput | Response> {
	if (request.headers.get('origin') !== origin)
		return json({ error: 'Same-origin frame feedback required' }, { status: 403 });
	if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? ''))
		return json({ error: 'JSON frame feedback required' }, { status: 415 });
	if (Number(request.headers.get('content-length')) > bodyLimit)
		return json({ error: 'Frame feedback exceeds 8192 bytes' }, { status: 413 });
	const bytes = await requestBytes(request);
	if (bytes instanceof Response) return bytes;
	try {
		const parsed = inputSchema.safeParse(
			JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
		);
		return parsed.success
			? parsed.data
			: json({ error: 'Invalid frame feedback input' }, { status: 400 });
	} catch {
		return json({ error: 'Invalid frame feedback JSON' }, { status: 400 });
	}
}

async function requestBytes(request: Request): Promise<Uint8Array | Response> {
	const reader = request.body?.getReader();
	if (!reader) return json({ error: 'Frame feedback body required' }, { status: 400 });
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > bodyLimit) {
				await reader.cancel();
				return json({ error: 'Frame feedback exceeds 8192 bytes' }, { status: 413 });
			}
			chunks.push(value);
		}
		return Buffer.concat(chunks, total);
	} finally {
		reader.releaseLock();
	}
}
