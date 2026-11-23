// @harness-uid u_rdiarfthls
import { createHash } from 'node:crypto';
import type { TrackerPhoneFetcher } from './RemoteDeviceSessionsService.types';
import { RemoteFailure } from '../../../../../remote/src/index';

const source = 'http://127.0.0.1:7701/phone-replica/v1';
const maxResponseBytes = 128 * 1024;

/** This port trusts the authenticated device session and never uses a caller-supplied scope. */
export function phoneTrackerPull(scopeParts: readonly string[], fetcher: TrackerPhoneFetcher) {
	const scope = trackerScope(scopeParts);
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

/** Forward a write using the current authenticated desktop's private loopback grant. */
export function phoneTrackerPush(
	scopeParts: readonly string[],
	grant: { device: string; token: string },
	fetcher: TrackerPhoneFetcher
) {
	const scope = trackerScope(scopeParts);
	return async (input: Record<string, unknown>, signal: AbortSignal) => {
		const intent = { ...input };
		delete intent.epoch;
		const body = JSON.stringify(intent);
		if (Buffer.byteLength(body) > 4096) throw new RemoteFailure('too-large');
		const response = await fetcher(new URL(source + '/write'), {
			method: 'POST',
			headers: {
				authorization: 'Bearer ' + grant.token,
				'content-type': 'application/json',
				'x-tracker-phone-device': grant.device,
				'x-tracker-phone-scope': scope
			},
			body,
			redirect: 'error',
			cache: 'no-store',
			signal: AbortSignal.any([signal, AbortSignal.timeout(8000)])
		});
		if (response.status === 403) throw new RemoteFailure('method-denied');
		if (response.status >= 400 && response.status < 500) throw new RemoteFailure('invalid-message');
		if (!response.ok) throw new RemoteFailure('failed');
		return await readProjection(response);
	};
}

function trackerScope(scopeParts: readonly string[]): string {
	return createHash('sha256').update(JSON.stringify(scopeParts)).digest('hex');
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
