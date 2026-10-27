import type { StoredRecord } from './VerificationStoreRepository.types';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { verificationsDirectory } from '../../core/verification-evidence/verifyTypes';
import type { VerificationRecord } from '../../core/verification-evidence/verificationTypes';
import { VerificationRecordValidator } from '../../validators/verification-evidence/VerificationRecordValidator';

/**
 * Scratch store of verification drafts. It lives outside the source tree and is the input from
 * which records are later persisted as immutable Git evidence.
 */
export class VerificationStoreRepository {
	private readonly store: string;
	private readonly validator = new VerificationRecordValidator();

	constructor(private readonly root: string) {
		this.store = join(root, verificationsDirectory);
	}

	/** A fresh directory for one run of one commit. */
	directoryFor(commit: string, startedAt: string): string {
		return join(this.store, commit, startedAt.replace(/[^0-9]/g, '').slice(0, 17));
	}

	async save(record: VerificationRecord, directory: string): Promise<void> {
		await mkdir(directory, { recursive: true });
		await writeFile(join(directory, 'record.json'), `${JSON.stringify(record, null, '\t')}\n`);
	}

	/** Loads by record id, or by a path to a record file; undefined when it is not a record. */
	load(reference: string): StoredRecord | undefined {
		const path = resolve(this.root, reference);
		if (existsSync(path) && statSync(path).isFile()) return this.read(path);
		return this.all().find((stored) => stored.record.id === reference);
	}

	/** The most recent record of a commit, whatever its outcome. */
	latest(commit: string): StoredRecord | undefined {
		return this.all()
			.filter((stored) => stored.record.source.commit === commit)
			.sort((left, right) => (left.record.startedAt < right.record.startedAt ? 1 : -1))[0];
	}

	all(): StoredRecord[] {
		return [...this.records()];
	}

	/** Visits valid records in store order without retaining the entire history. */
	*records(): IterableIterator<StoredRecord> {
		if (!existsSync(this.store)) return;
		for (const commit of readdirSync(this.store)) {
			for (const run of readdirSync(join(this.store, commit))) {
				const stored = this.read(join(this.store, commit, run, 'record.json'));
				if (stored) yield stored;
			}
		}
	}

	/** Reads one record file; a missing, malformed or schema-invalid file is not a record. */
	read(path: string): StoredRecord | undefined {
		try {
			const parsed = this.validator.validate(JSON.parse(readFileSync(path, 'utf8')));
			return parsed.value ? { record: parsed.value, directory: dirname(path) } : undefined;
		} catch {
			return undefined;
		}
	}
}

export type { StoredRecord } from './VerificationStoreRepository.types';
