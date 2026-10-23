import type {
	PinnedHistory,
	VerificationNote,
	CommitStatus,
	RecordStatus
} from './HistoryStatusService.types';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type { VerificationRecord } from '../../../core/verification-evidence/verificationTypes';
import { HistoryNoteRepository } from '../../../repositories/git-source-history/history-note-repository/HistoryNoteRepository';
import type { ReadNote } from '../../../utils/git-source-history/note-lines/noteCommit';
import { recordLineage } from '../../../utils/development-tooling/recordLineage';
import { verificationNoteIdentity } from '../../../utils/verification-evidence/verificationNoteIdentity';
import {
	AttachedRecordService,
	type AttachedRecord
} from './attached-record-service/AttachedRecordService';

/**
 * What Git alone proves about a commit: the records attached to it, whether each is intact
 * together with everything it inherits, and every line or file that could not be used.
 */
export class HistoryStatusService {
	readonly attached: AttachedRecordService;
	private readonly notes: HistoryNoteRepository;
	private readonly git: GitAdapter;
	private everything: Promise<Map<string, ReadNote>> | undefined;

	/** Pinned, everything is read at exactly those two commits, wherever the refs are by now. */
	constructor(
		root: string,
		readonly pinned?: PinnedHistory
	) {
		this.attached = new AttachedRecordService(root, pinned?.evidence);
		this.notes = new HistoryNoteRepository(root);
		this.git = new GitAdapter(root);
	}

	/** Every note in the repository, read once. */
	all(): Promise<Map<string, ReadNote>> {
		this.everything ??= this.notes.all(this.pinned?.notes);
		return this.everything;
	}

	/** Verification lines of every commit, which is where a record id is looked up. */
	async verifications(): Promise<VerificationNote[]> {
		const notes = [...(await this.all()).values()];
		return notes.flatMap((note) =>
			note.entries.filter((entry): entry is VerificationNote => entry.kind === 'verification')
		);
	}

	async status(commit: string): Promise<CommitStatus> {
		const note = (await this.all()).get(commit) ?? { entries: [], problems: [] };
		const lines = note.entries.filter(
			(entry): entry is VerificationNote => entry.kind === 'verification'
		);
		const records: RecordStatus[] = [];
		const seen = new Set<string>();
		for (const line of lines.filter((item) => !seen.has(item.record) && seen.add(item.record))) {
			const problems = await this.problems(line);
			// The sealed record states the outcome; a note is only an index to it.
			const sealed = (await this.attached.load(line.evidence)).record;
			const status = sealed?.id === line.record ? sealed.status : line.status;
			const { record, evidence } = line;
			records.push({ record, status, valid: problems.length === 0, problems, evidence });
		}
		const verified = records.some((record) => record.status === 'passed' && record.valid);
		return { commit, verified, records, problems: note.problems };
	}

	/** Everything wrong with one attached record, including what it inherits. */
	async problems(line: VerificationNote): Promise<string[]> {
		const loaded = await this.attached.load(line.evidence);
		const own = await this.own(line, loaded);
		if (!loaded.record || own.length > 0) return own;
		const known = await this.dependencies(loaded.record, new Map());
		return recordLineage(loaded.record, {
			find: (id) => known.get(id)?.record,
			problems: (dependency) => known.get(dependency.id)?.problems ?? []
		});
	}

	/** A record must be the one the note names, for the commit and tree that really exist. */
	private async own(line: VerificationNote, loaded: AttachedRecord): Promise<string[]> {
		const { record } = loaded;
		if (!record) return loaded.problems;
		const tree = await this.git.attempt(['rev-parse', '--verify', `${line.source.commit}^{tree}`]);
		const identity = verificationNoteIdentity(record, line, tree);
		return [...loaded.problems, ...identity];
	}

	/** Loads every record a record depends on, transitively, so lineage can be judged. */
	private async dependencies(
		record: VerificationRecord,
		known: Map<string, { record: VerificationRecord; problems: string[] }>
	): Promise<typeof known> {
		const referenced = record.scenarios.flatMap((scenario) => scenario.referencedRecord ?? []);
		const wanted = [...new Set([record.source.baseRecord ?? '', ...referenced])].filter(Boolean);
		const lines = await this.verifications();
		for (const id of wanted.filter((item) => !known.has(item))) {
			const line = lines.find((item) => item.record === id);
			const loaded = line ? await this.attached.load(line.evidence) : undefined;
			if (!line || !loaded?.record) continue;
			known.set(id, { record: loaded.record, problems: await this.own(line, loaded) });
			await this.dependencies(loaded.record, known);
		}
		return known;
	}
}

export type { RecordStatus, CommitStatus, PinnedHistory } from './HistoryStatusService.types';
