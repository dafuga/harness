// @harness-uid u_q5pl6yqth7
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { TrackerSyncRequest } from './TrackerSyncAuthService.types';

const clockSkewMs = 5 * 60_000;
const trackerAuthorization = /^TrackerHMAC ts=(\d+),sig=([0-9a-f]{64})$/;

/** Wire-compatible authentication for Tracker's shared-secret sync requests. */
export class TrackerSyncAuthService {
	readonly #secret: string | Uint8Array;

	constructor(secret: string | Uint8Array) {
		this.#secret = secret;
	}

	/** Returns the Authorization header for the supplied method, target, and serialized body. */
	authorizationHeader(request: TrackerSyncRequest, now: number = Date.now()): string {
		return `TrackerHMAC ts=${now},sig=${this.signature(request, now).toString('hex')}`;
	}

	/** Checks the header against the request and the legacy inclusive five-minute clock window. */
	verify(
		request: TrackerSyncRequest,
		authorization: string | undefined,
		now: number = Date.now()
	): boolean {
		const match = trackerAuthorization.exec(authorization ?? '');
		if (!match) return false;
		const timestamp = Number(match[1]);
		if (Math.abs(now - timestamp) > clockSkewMs) return false;
		return timingSafeEqual(this.signature(request, timestamp), Buffer.from(match[2], 'hex'));
	}

	private signature(
		{ method, pathAndQuery, body = '' }: TrackerSyncRequest,
		timestamp: number
	): Buffer {
		const bodyHash = createHash('sha256').update(body).digest('hex');
		return createHmac('sha256', this.#secret)
			.update(`${method}\n${pathAndQuery}\n${timestamp}\n${bodyHash}`)
			.digest();
	}
}
