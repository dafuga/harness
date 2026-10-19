import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CommitTreeAdapter } from '../adapters/CommitTreeAdapter';
import type { TreeFile } from '../adapters/EvidenceTreeAdapter';
import { GitAdapter } from '../adapters/GitAdapter';
import { LfsAdapter } from '../adapters/LfsAdapter';
import { fail } from '../core/errors';
import {
	notesRef,
	recordsDirectory,
	type EvidencePointer,
	type HistoryNote
} from '../core/historyTypes';
import { BudgetLedgerRepository } from '../repositories/BudgetLedgerRepository';
import { EvidenceBranchRepository } from '../repositories/EvidenceBranchRepository';
import { HistoryNoteRepository } from '../repositories/HistoryNoteRepository';
import {
	VerificationStoreRepository,
	type StoredRecord
} from '../repositories/VerificationStoreRepository';
import { evidenceManifest } from '../utils/evidenceManifest';
import { sourceArchiveRef } from '../utils/historyRefs';
import { lfsPointer } from '../utils/lfsPointer';
import { stableJson } from '../utils/stableJson';
import { VerificationCheckService } from './VerificationCheckService';

export interface Attached {
	record: string;
	status: 'passed' | 'failed';
	source: string;
	evidence: EvidencePointer;
	note: string;
	archive: string;
	/** False when this exact record was already attached. */
	created: boolean;
}

/**
 * Persists a verification record after its source commit exists. The commit is not touched:
 * the record and its files go to the evidence branch, a note names them, and an archive ref
 * keeps the tested commit reachable. A record is accepted only if it and its files are intact.
 */
export class EvidenceAttachService {
	private readonly store: VerificationStoreRepository;
	private readonly evidence: EvidenceBranchRepository;
	private readonly notes: HistoryNoteRepository;
	private readonly lfs: LfsAdapter;
	/** One checker for every record of this attach: a file parsed once is not parsed again. */
	private readonly checker: VerificationCheckService;
	private readonly done = new Map<string, Attached>();

	constructor(private readonly root: string) {
		this.store = new VerificationStoreRepository(root);
		this.evidence = new EvidenceBranchRepository(root);
		this.notes = new HistoryNoteRepository(root);
		this.lfs = new LfsAdapter(root);
		this.checker = new VerificationCheckService(root);
	}

	/** Attaches a record of `commit`, first attaching every record it inherits from. */
	async attach(commit: string, stored: StoredRecord): Promise<Attached> {
		const { record } = stored;
		const known = this.done.get(record.id);
		if (known) return known;
		const problems = await this.checker.integrity(commit, stored);
		if (problems.length > 0) {
			return fail(`Record ${short(record.id)} cannot be attached: ${problems.join('\n')}`);
		}
		await this.dependencies(stored);
		const { pointer, created } = await this.persist(commit, stored);
		await this.notes.append(commit, noteEntries(stored, pointer));
		const attached: Attached = {
			record: record.id,
			status: record.status,
			source: commit,
			evidence: pointer,
			note: notesRef,
			archive: await this.archive(commit),
			created
		};
		this.done.set(record.id, attached);
		return attached;
	}

	/** Writes the record directory to the evidence branch and returns where it is. */
	private async persist(
		commit: string,
		stored: StoredRecord
	): Promise<{ pointer: EvidencePointer; created: boolean }> {
		const { record } = stored;
		const recordJson = await readFile(join(stored.directory, 'record.json'));
		const manifest = evidenceManifest(record, recordJson);
		const text = stableJson(manifest);
		const path = `${recordsDirectory}/${commit}/${record.id}`;
		const added = await this.evidence.add(
			path,
			await this.files(stored, manifest, text),
			`chore: record ${record.status} verification ${short(record.id)} of ${short(commit)}`,
			'manifest.json'
		);
		const pointer = { commit: added.commit, path, manifest: sha256(text) };
		return { pointer, created: added.created };
	}

	/** Keeps the tested commit reachable. Writers of one commit all want the same ref value. */
	private async archive(commit: string): Promise<string> {
		const ref = sourceArchiveRef(commit);
		const git = new GitAdapter(this.root);
		const kept = () => git.attempt(['rev-parse', '--verify', '--quiet', ref]);
		for (let attempt = 0; attempt < 20 && (await kept()) !== commit; attempt += 1) {
			await git.exec(['update-ref', ref, commit]);
		}
		return (await kept()) === commit ? ref : fail(`Could not keep ${commit} reachable at ${ref}.`);
	}

	/**
	 * The base record and the records behind inherited scenarios are attached first, and so are
	 * the records the budget ledger of this commit cites, so every clone can check the ledger.
	 */
	private async dependencies(stored: StoredRecord): Promise<void> {
		const { record } = stored;
		const inherited = record.scenarios.flatMap((scenario) => scenario.referencedRecord ?? []);
		for (const id of new Set([record.source.baseRecord ?? '', ...inherited])) {
			if (!id) continue;
			const subject = `Record ${short(record.id)} cannot be attached`;
			const dependency =
				this.store.load(id) ??
				fail(`${subject}: it inherits from record ${short(id)}, which is not available`);
			await this.attach(dependency.record.source.commit, dependency);
		}
		const tree = await CommitTreeAdapter.open(this.root, record.source.commit);
		const ledger = await new BudgetLedgerRepository(this.root).read(tree);
		for (const id of new Set(ledger.events.map((event) => event.record.id))) {
			const cited = id === record.id ? undefined : this.store.load(id);
			if (cited) await this.attach(cited.record.source.commit, cited);
		}
	}

	/** Media is stored as an LFS object behind a pointer; everything else as it is. */
	private async files(
		stored: StoredRecord,
		manifest: ReturnType<typeof evidenceManifest>,
		manifestText: string
	): Promise<TreeFile[]> {
		const files: TreeFile[] = [{ path: 'manifest.json', content: { bytes: manifestText } }];
		for (const file of manifest.files) {
			const source = join(stored.directory, file.path);
			if (file.storage === 'git') files.push({ path: file.path, content: { file: source } });
			else {
				await this.lfs.store(await readFile(source));
				files.push({ path: file.path, content: { bytes: lfsPointer(file) } });
			}
		}
		return files;
	}
}

/** One line for the record, and one for each reason that satisfied it. */
function noteEntries(stored: StoredRecord, evidence: EvidencePointer): HistoryNote[] {
	const { record } = stored;
	const { commit, tree, base } = record.source;
	const reasons = (record.reasons.entries ?? []).map(
		(explanation): HistoryNote => ({ schemaVersion: 1, kind: 'reason', commit, explanation })
	);
	const verification: HistoryNote = {
		schemaVersion: 1,
		kind: 'verification',
		record: record.id,
		status: record.status,
		profile: record.profile.id,
		finishedAt: record.finishedAt,
		source: { commit, tree, base },
		evidence
	};
	return [verification, ...reasons];
}

function sha256(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}

function short(id: string): string {
	return id.slice(0, 12);
}
