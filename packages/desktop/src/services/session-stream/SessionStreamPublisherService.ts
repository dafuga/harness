// @harness-uid u_idvtlr5mn3
import {
	sealedFrame,
	sealedStreamKey
} from '../../../../remote/src/utils/networking-security/sealedFrame';
import { sealedPadding } from '../../../../remote/src/utils/networking-security/sealedPadding';
import { sealedRecord } from '../../../../remote/src/utils/networking-security/sealedRecord';
import {
	scopeName,
	sealedObjectId
} from '../../../../remote/src/utils/networking-security/sealedScopeKeys';
import { toBase64Url } from '../../../../remote/src/utils/networking-security/remoteBytes';
import type { ScopeKeys } from '../../../../remote/src/models/networking-security/Sealed.types';
import type {
	SessionRunStatus,
	SessionStreamTransport
} from './SessionStreamPublisherService.types';

const chunkBytes = 128 * 1024;

/** One run on one enrolled device. Reopening a run starts a fresh live stream. */
export class SessionStreamPublisherService {
	private readonly streamId = crypto.getRandomValues(new Uint8Array(16));
	private counter = 0n;
	private streamKey?: Promise<CryptoKey>;
	private pending = Promise.resolve();
	private closed = false;

	constructor(
		private readonly keys: ScopeKeys,
		private readonly runId: string,
		private readonly transport: SessionStreamTransport
	) {}

	publishStatus(status: SessionRunStatus): Promise<void> {
		const snapshot = structuredClone(status);
		return this.enqueue(async () => {
			await this.publishRecord('session', this.runId, {
				kind: 'session',
				runId: this.runId,
				streamId: toBase64Url(this.streamId),
				status: snapshot.status,
				details: snapshot.details ?? null
			});
		});
	}

	publishOutput(bytes: Uint8Array): Promise<void> {
		const data = bytes.slice();
		return this.enqueue(async () => {
			if (!data.length) return;
			const key = await (this.streamKey ??= sealedStreamKey(this.keys, this.streamId));
			for (let offset = 0; offset < data.length; offset += chunkBytes) {
				const counter = this.counter++;
				const chunk = data.subarray(offset, offset + chunkBytes);
				await this.transport.sendFrame(
					await sealedFrame(this.keys, key, {
						streamId: this.streamId,
						counter,
						data: sealedPadding(chunk)
					})
				);
			}
		});
	}

	/** The caller supplies a stable segment index for retries and history ordering. */
	publishTranscriptSegment(index: number, bytes: Uint8Array): Promise<void> {
		if (!Number.isSafeInteger(index) || index < 0 || bytes.length > chunkBytes)
			return Promise.reject(new Error('Invalid transcript segment.'));
		const data = toBase64Url(bytes);
		return this.enqueue(async () => {
			await this.publishRecord('transcript', JSON.stringify([this.runId, index]), {
				kind: 'transcript',
				runId: this.runId,
				index,
				data,
				// Keep short segments above the object API's 32 KiB inline threshold.
				padding: ' '.repeat(Math.max(0, 32 * 1024 - data.length))
			});
		});
	}

	async close(): Promise<void> {
		this.closed = true;
		await this.pending;
		this.transport.close();
	}

	private async publishRecord(kind: string, id: string, value: object): Promise<void> {
		const scope = scopeName(this.keys);
		const objectId = await sealedObjectId(this.keys, kind, id);
		const address = toBase64Url(objectId);
		const revision = (await this.transport.readRevision(scope, address)) + 1n;
		if (revision > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Session revision exhausted.');
		const envelope = await sealedRecord(this.keys, { objectId, revision }, value);
		await this.transport.putObject(scope, address, envelope);
	}

	private enqueue(operation: () => Promise<void>): Promise<void> {
		if (this.closed) return Promise.reject(new Error('Session publisher is closed.'));
		const result = this.pending.then(operation);
		this.pending = result.catch(() => undefined);
		return result;
	}
}
