import { createHash } from 'node:crypto';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fail } from '../../../src/core/errors';
import {
	VerificationStoreRepository,
	type StoredRecord
} from '../../../src/repositories/VerificationStoreRepository';
import { EvidenceAttachService, type Attached } from '../../../src/services/EvidenceAttachService';
import { EvidenceRestoreService } from '../../../src/services/EvidenceRestoreService';
import { sourceCommit } from '../../../src/workflows/runHistory';

/** What `harness history attach` is told: a commit, `HEAD` when omitted, and maybe a record. */
export interface SeedAttach {
	commit?: string;
	record?: string;
}

/** Repositories that have had an attacher in this process; none of them ever gets another. */
const owned = new Set<string>();

/**
 * Attaches the records of one seed of one synthetic repository as `harness history attach` does,
 * through one attach service for the whole seed, so a record the seed already checked and
 * attached is not checked again when a later one inherits it. That holds only while nothing
 * changes those records: the attacher refuses another repository, a second attacher of its own
 * repository, any use once closed, and any stored record that changed or went away since it
 * last looked.
 */
export class SeedAttacher {
	private readonly service: EvidenceAttachService;
	private readonly store: VerificationStoreRepository;
	/** Each stored record by id, with one hash of every file it had when last seen. */
	private seen = new Map<string, string>();
	private closed = false;

	private constructor(readonly root: string) {
		this.service = new EvidenceAttachService(root);
		this.store = new VerificationStoreRepository(root);
	}

	/** The one attacher of the repository at `root` for the seed that owns it. */
	static async open(root: string): Promise<SeedAttacher> {
		const real = await realpath(root);
		if (owned.has(real)) fail(`${real} already had a seed attacher; a seed has only one.`);
		owned.add(real);
		return new SeedAttacher(real);
	}

	/** Attaches a stored record of the repository at `root`, which must be this attacher's. */
	async attach(root: string, options: SeedAttach = {}): Promise<Attached> {
		if (this.closed) fail('This seed attacher is closed.');
		if ((await realpath(root)) !== this.root) {
			fail(`${root} is not the repository of this seed attacher, ${this.root}.`);
		}
		this.seen = await this.unchanged();
		const commit = await sourceCommit(this.root, options.commit);
		await new EvidenceRestoreService(this.root).restore();
		return this.service.attach(commit, this.stored(commit, options.record));
	}

	/** Ends the attaching of this seed, once every record it saw is found unchanged. */
	async close(): Promise<void> {
		await this.unchanged();
		this.closed = true;
	}

	/** The exact record asked for, or the latest of the commit, which must be its source. */
	private stored(commit: string, record?: string): StoredRecord {
		const found = record ? this.store.load(record) : this.store.latest(commit);
		if (!found || (record && found.record.id !== record)) {
			return fail(
				record
					? `${record} is not a verification record.`
					: `No verification record exists for ${commit}; run harness verify run.`
			);
		}
		const source = found.record.source.commit;
		if (source !== commit) fail(`Record ${found.record.id} is of ${source}, not of ${commit}.`);
		return found;
	}

	/** Every stored record as it is now, after checking that none seen before has changed. */
	private async unchanged(): Promise<Map<string, string>> {
		const now = new Map<string, string>();
		for (const stored of this.store.all()) {
			now.set(stored.record.id, await digest(stored.directory));
		}
		for (const [id, before] of this.seen) {
			if (now.get(id) !== before) fail(`Record ${id} changed or went away during this seed.`);
		}
		return now;
	}
}

/** One hash of every file of a record directory, each by its relative path and its bytes. */
async function digest(directory: string): Promise<string> {
	const hash = createHash('sha256');
	for (const path of (await readdir(directory, { recursive: true })).sort()) {
		const file = join(directory, path);
		if (!(await stat(file)).isFile()) continue;
		const bytes = await readFile(file);
		hash.update(`${path}\0${bytes.length}\0`).update(bytes);
	}
	return hash.digest('hex');
}
