import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { VerificationStoreRepository } from '../repositories/VerificationStoreRepository';
import { HistoryStatusService } from './HistoryStatusService';

export interface Restored {
	restored: string[];
	/** Attached records that could not be restored, each with what is wrong with it. */
	skipped: Array<{ record: string; problems: string[] }>;
}

/**
 * Rebuilds the local record cache from Git. Only a record whose manifest, files and media are
 * all intact is restored; anything else stays absent, so a damaged record can never be trusted
 * by way of the cache.
 */
export class EvidenceRestoreService {
	private readonly store: VerificationStoreRepository;
	private readonly history: HistoryStatusService;

	constructor(root: string) {
		this.store = new VerificationStoreRepository(root);
		this.history = new HistoryStatusService(root);
	}

	async restore(): Promise<Restored> {
		const lines = await this.history.verifications();
		const result: Restored = { restored: [], skipped: [] };
		if (lines.length === 0) return result;
		const local = new Set(this.store.all().map((stored) => stored.record.id));
		for (const line of lines.filter((item) => !local.has(item.record))) {
			local.add(line.record);
			const loaded = await this.history.attached.load(line.evidence);
			const { record, problems } = loaded;
			if (!record || problems.length > 0 || record.id !== line.record) {
				result.skipped.push({ record: line.record, problems });
				continue;
			}
			await this.write(
				this.store.directoryFor(record.source.commit, record.startedAt),
				loaded.files
			);
			result.restored.push(record.id);
		}
		return result;
	}

	/** Evidence first and the record last and atomically, so a half-written record never loads. */
	private async write(directory: string, files: Map<string, Buffer>): Promise<void> {
		const record = 'record.json';
		for (const [path, bytes] of [...files].filter(([name]) => name !== record)) {
			await mkdir(dirname(join(directory, path)), { recursive: true });
			await writeFile(join(directory, path), bytes);
		}
		const partial = join(directory, `${record}.${process.pid}.${randomUUID()}.partial`);
		await mkdir(directory, { recursive: true });
		await writeFile(partial, files.get(record) ?? '');
		await rename(partial, join(directory, record));
	}
}
