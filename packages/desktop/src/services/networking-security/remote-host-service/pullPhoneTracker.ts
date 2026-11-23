// @harness-uid u_rdiarfthls
import { createHash } from 'node:crypto';
import type { TrackerPhoneFetcher } from './RemoteDeviceSessionsService.types';
import { RemoteFailure } from '../../../../../remote/src/index';

const source = 'http://127.0.0.1:7701/phone-replica/v1';
const maxResponseBytes = 128 * 1024;

/** This port trusts the authenticated device session and never uses a caller-supplied scope. */
export function phoneTrackerPull(scopeParts: readonly string[], fetcher: TrackerPhoneFetcher) {
	const scope = createHash('sha256').update(JSON.stringify(scopeParts)).digest('hex');
	return async (input: Record<string, unknown>) => {
		const url = new URL(source);
		url.searchParams.set('scope', scope);
		appendPosition(url, input);
		const response = await fetcher(url, {
			redirect: 'error',
			cache: 'no-store',
			signal: AbortSignal.timeout(8000)
		});
		if (!response.ok) throw new RemoteFailure('failed');
		return await readProjection(response);
	};
}

function appendPosition(url: URL, input: Record<string, unknown>) {
	const { version, cursor, continuation, ...extra } = input;
	if (Object.keys(extra).length) throw new RemoteFailure('invalid-message');
	if (version !== 1) throw new RemoteFailure('protocol-unsupported');
	if (cursor !== undefined && continuation !== undefined)
		throw new RemoteFailure('invalid-message');
	for (const [name, value] of Object.entries({ cursor, continuation })) {
		if (value === undefined) continue;
		if (typeof value !== 'string' || !/^[A-Za-z0-9_:-]{1,512}$/.test(value))
			throw new RemoteFailure('invalid-message');
		url.searchParams.set(name, value);
	}
}

async function readProjection(response: Response): Promise<unknown> {
	const stream = response.body?.getReader();
	if (!stream) throw new RemoteFailure('failed');
	const parts: Uint8Array[] = [];
	let total = 0;
	try {
		for (let part = await stream.read(); !part.done; part = await stream.read()) {
			total += part.value.length;
			if (total > maxResponseBytes) {
				await stream.cancel();
				throw new RemoteFailure('too-large');
			}
			parts.push(part.value);
		}
		return JSON.parse(Buffer.concat(parts).toString('utf8')) as unknown;
	} finally {
		stream.releaseLock();
	}
}
