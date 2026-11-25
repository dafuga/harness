// @harness-uid u_grqcubeu7b
import { TrackerNodeTransportError } from '../tracker-node-service/TrackerNodeTransportError';
import { randomBytes } from 'node:crypto';

import {
	openSealedRecord,
	sealedRecord,
	sealedRecordHeader
} from '../../../../packages/remote/src/utils/networking-security/sealedRecord';
import type { TrackerOperation } from '../../../repositories/projects-sessions/TrackerOperationRepository.types';

import type {
	OutboxEntry,
	SyncPage,
	TrackerSealedSyncOptions
} from './TrackerSealedSyncService.types';

function base64url(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64url');
}

/** One sealed log for a verified device and scope. */
export class TrackerSealedSyncService {
	private readonly url: URL;

	constructor(private readonly options: TrackerSealedSyncOptions) {
		if (options.origin.protocol !== 'https:' || options.origin.username || options.origin.password)
			throw new TypeError('Tracker sealed sync requires a credential-free HTTPS origin');
		const scope = base64url(options.currentKeys.scopeId);
		this.url = new URL('/api/sync/v1/ops/' + scope, options.origin);
	}

	async stage(localSeq: number, operation: TrackerOperation): Promise<void> {
		const objectId = randomBytes(32);
		const envelope = await sealedRecord(
			this.options.currentKeys,
			{ objectId, revision: 0n },
			operation
		);
		if (envelope.byteLength > 256 * 1024)
			throw new RangeError('Sealed Tracker operation exceeds the Hub limit');
		this.options.store.stage({ localSeq, envelope: base64url(envelope) });
	}

	/** Flush a bounded batch. A failed request leaves the same envelope ids ready to retry. */
	async push(signal?: AbortSignal): Promise<number> {
		const entries = batch(this.options.store.pending());
		if (!entries.length) return 0;
		const payload = await this.request(this.url, {
			method: 'POST',
			signal,
			body: JSON.stringify(entries.map(({ envelope }) => envelope))
		});
		assertReceipt(payload, entries);
		this.options.store.acknowledge(entries);
		return entries.length;
	}

	/** Authenticate and decode the whole page before committing operations or the cursor. */
	async pull(signal?: AbortSignal): Promise<boolean> {
		const after = this.options.store.cursor();
		const url = new URL(this.url);
		url.searchParams.set('after', String(after));
		const page = (await this.request(url, { signal })) as SyncPage;
		assertPage(page, after);
		const operations = await Promise.all(page.ops.map((entry) => this.open(entry)));
		this.options.store.apply(after, page.next, operations);
		return page.more;
	}

	private async open(entry: SyncPage['ops'][number]): Promise<TrackerOperation> {
		const envelope = Buffer.from(entry.envelope, 'base64url');
		const header = sealedRecordHeader(envelope);
		const keys = this.options.keysAt(header.epoch);
		if (
			!keys ||
			base64url(header.objectId) !== entry.opId ||
			base64url(header.scopeId) !== base64url(this.options.currentKeys.scopeId)
		)
			throw new TrackerNodeTransportError('Invalid sealed Tracker operation header');
		const { value } = await openSealedRecord<TrackerOperation>(keys, envelope);
		if (this.options.acceptOperation && !this.options.acceptOperation(value))
			throw new TrackerNodeTransportError(
				'Sealed Tracker operation falls outside its authorized scope'
			);
		return value;
	}

	private async request(url: URL, init: RequestInit): Promise<unknown> {
		const response = await this.options.request(url, {
			...init,
			redirect: 'error',
			headers: { 'Content-Type': 'application/json', 'X-Harness-Device': this.options.deviceId }
		});
		if (!response.ok)
			throw new TrackerNodeTransportError(`Tracker sealed sync failed (HTTP ${response.status})`);
		return response.json();
	}
}

function batch(pending: readonly OutboxEntry[]): OutboxEntry[] {
	const entries: OutboxEntry[] = [];
	let estimatedBytes = 2;
	for (const entry of pending.slice(0, 64)) {
		estimatedBytes += entry.envelope.length + 3;
		if (estimatedBytes > 1024 * 1024) break;
		entries.push(entry);
	}
	return entries;
}

function assertReceipt(payload: unknown, entries: readonly OutboxEntry[]): void {
	const receipt = payload as { ops?: { opId: string; seq: number }[] } | null;
	if (!Array.isArray(receipt?.ops) || receipt.ops.length !== entries.length)
		throw new TrackerNodeTransportError('Incomplete sealed Tracker receipt');
	for (const [index, entry] of entries.entries()) {
		const id = sealedRecordHeader(Buffer.from(entry.envelope, 'base64url')).objectId;
		const row = receipt.ops[index];
		if (row?.opId !== base64url(id) || !Number.isSafeInteger(row.seq) || row.seq <= 0)
			throw new TrackerNodeTransportError('Invalid sealed Tracker receipt');
	}
}

function assertPage(page: SyncPage, after: number): void {
	if (!Array.isArray(page?.ops) || typeof page.more !== 'boolean')
		throw new TrackerNodeTransportError('Invalid sealed Tracker page');
	const contiguous = page.ops.every((entry, index) => entry?.seq === after + index + 1);
	if (!contiguous || page.next !== after + page.ops.length || (page.more && !page.ops.length))
		throw new TrackerNodeTransportError('Invalid sealed Tracker cursor');
}
