// @harness-uid u_jkomno4o5u
import type { TrackerHubRequest } from '../TrackerHubSyncService.types';
import { TrackerHubInputError } from './TrackerHubInputError';

const maxBodyBytes = 8 * 1024 * 1024;

export async function readTrackerHubBody({ body, signal }: TrackerHubRequest): Promise<string> {
	if (!body) return '';
	const reader = body.getReader();
	const cancel = () => void reader.cancel().catch(() => {});
	signal?.addEventListener('abort', cancel, { once: true });
	try {
		const chunks: Uint8Array[] = [];
		let size = 0;
		for (let part = await reader.read(); !part.done; part = await reader.read()) {
			size += part.value.byteLength;
			if (size > maxBodyBytes) {
				cancel();
				throw new TrackerHubInputError(413, 'body too large');
			}
			chunks.push(part.value);
		}
		signal?.throwIfAborted();
		return decodeUtf8(Buffer.concat(chunks, size));
	} finally {
		signal?.removeEventListener('abort', cancel);
		reader.releaseLock();
	}
}

function decodeUtf8(bytes: Uint8Array): string {
	try {
		return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
	} catch {
		throw new TrackerHubInputError(400, 'invalid UTF-8 body');
	}
}

export function trackerHubResponse(status: number, payload: unknown): Response {
	const body = JSON.stringify(payload);
	return new Response(body, {
		status,
		headers: {
			'content-type': 'application/json',
			'content-length': String(Buffer.byteLength(body))
		}
	});
}

export function trackerHubError(error: unknown): Response {
	if (error instanceof TrackerHubInputError) {
		return trackerHubResponse(error.status, { error: error.message });
	}
	return trackerHubResponse(500, { error: 'internal server error' });
}
