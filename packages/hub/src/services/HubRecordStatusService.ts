import { verificationNoteIdentity } from '../../../../src/utils/verificationNoteIdentity';
import type { HistoryNote } from '../../../../src/core/historyTypes';
import type { VerificationRecord } from '../../../../src/core/verificationTypes';
import type { ReadNote } from '../../../../src/utils/noteLines';
import { recordLineage } from '../../../../src/utils/recordLineage';
import type { HubAttachedRecord } from '../utils/hubAttachedRecord';
import type { CommitStatus, RecordStatus } from '../../../../src/services/HistoryStatusService';
import type { HubAttachedService } from './HubAttachedService';

type VerificationNote = Extract<HistoryNote, { kind: 'verification' }>;
interface Context {
	notes: Promise<Map<string, ReadNote>>;
	attached: HubAttachedService;
	tree: (commit: string) => Promise<string | undefined>;
}
/** Request-scoped reader; the caller authorizes before constructing this frozen context. */
export class HubRecordStatusService {
	readonly attached: HubAttachedService;
	constructor(private readonly context: Context) {
		this.attached = context.attached;
	}
	/** Every note in the repository, read once. */
	all(): Promise<Map<string, ReadNote>> {
		return this.context.notes;
	}

	/** Verification lines of every commit, which is where a record id is looked up. */
	async verifications(): Promise<VerificationNote[]> {
		const notes = [...(await this.all()).values()];
		return notes.flatMap((note) =>
			note.entries.filter((entry): entry is VerificationNote => entry.kind === 'verification')
		);
	}

	async status(commit: string): Promise<CommitStatus> {
		const note = (await this.all()).get(commit) ?? {
			entries: [],
			problems: []
		};
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
			records.push({
				record,
				status,
				valid: problems.length === 0,
				problems,
				evidence
			});
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
	private async own(line: VerificationNote, loaded: HubAttachedRecord): Promise<string[]> {
		const { record } = loaded;
		if (!record) return loaded.problems;
		const tree = await this.context.tree(line.source.commit);
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
			known.set(id, {
				record: loaded.record,
				problems: await this.own(line, loaded)
			});
			await this.dependencies(loaded.record, known);
		}
		return known;
	}
}
