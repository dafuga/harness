import type { Known, Pinned, CommitFacts, PinnedRevision } from './PinnedHistoryAdapter.types';
import { SourceHistoryRepository } from '../../../../../../src/repositories/source-history-repository/SourceHistoryRepository';
import { HistoryStatusService } from '../../../../../../src/services/history-status-service/HistoryStatusService';
import {
	RevisionDetailService,
	revisionSources
} from '../../../../../../src/services/explorer-ui/revision-detail-service/RevisionDetailService';
import { RegressionProofRepository } from '../../../../../../src/repositories/verification-evidence/RegressionProofRepository';
import { checkedMedia } from '../../../../../../src/utils/development-tooling/mediaPlace';
import { revisionSummary } from '../../../../../../src/utils/development-tooling/revisionSummary';
import type { HarnessRevision } from '../../../../../reports/src/models/Harness.types';
import type { PinnedRevisions } from '../../../adapters/EvidenceRefsAdapter';

/** What stays read: two pairs of revisions, and of each the commits of two views. */
const most = { pins: 2, commits: 4 };
function key(pins: PinnedRevisions): string {
	return `${pins.notesRevision}:${pins.evidenceRevision}`;
}
/** Puts an entry last, and lets go of the entries that were used longest ago. */
function recent<Value>(known: Known<Value>, name: string, value: Value, kept: number): Value {
	known.delete(name);
	known.set(name, value);
	for (const old of [...known.keys()].slice(0, -kept)) known.delete(old);
	return value;
}

/**
 * The stored history of a repository at pinned revisions, through the services that build the
 * history index: the same validation of every record, its files and what it inherits, for one
 * commit at a time and without writing anything. What is pinned cannot change, so a commit is
 * read once for its revisions, and its source is indexed once whatever the notes are by then.
 * A commit whose records could not all be validated is read again the next time, since media
 * may have been fetched meanwhile. Only the last few of each are kept.
 */
export class PinnedHistoryAdapter {
	private readonly pinned = new Map<string, Pinned>();
	private readonly indexed = new Set<string>();
	private readonly source: SourceHistoryRepository;
	private sources: ReturnType<typeof revisionSources>;

	constructor(private readonly root: string) {
		this.source = new SourceHistoryRepository(root);
		this.sources = revisionSources(root);
	}

	/** One commit as Git states it, without reading anything that is stored for it. */
	async facts(commit: string): Promise<CommitFacts> {
		const stated = await this.source.revision(commit, []);
		if (!stated) throw new Error('This commit is not in the repository of this project.');
		const { parents, subject, author, committedAt } = stated;
		return { commit: stated.commit, parents, subject, author, committedAt };
	}

	revision(pins: PinnedRevisions, commit: string): Promise<PinnedRevision> {
		const held = this.at(pins);
		const building = held.built.get(commit) ?? this.read(held.history, commit);
		const known = recent(held.built, commit, building, most.commits);
		const sound = (built: PinnedRevision) => built.judged.records.every((item) => item.valid);
		// What could not be validated, or read at all, is not kept: the next read starts again.
		void known.then(sound, () => false).then((keep) => keep || this.pinned.delete(key(pins)));
		return known;
	}

	/** The verified files of the record with this id, where the pinned notes point to it. */
	async files(pins: PinnedRevisions, record: string): Promise<Map<string, Buffer> | undefined> {
		const { history } = this.at(pins);
		const line = (await history.verifications()).find((item) => item.record === record);
		if (!line) {
			const note = [...(await history.all()).values()]
				.flatMap((item) => item.entries)
				.find((item) => item.kind === 'regression' && item.record === record);
			return note?.kind === 'regression'
				? (await new RegressionProofRepository(this.root, pins.evidenceRevision).load(note)).files
				: undefined;
		}
		const loaded = await history.attached.load(line.evidence);
		const intact = loaded?.record?.id === record && loaded.problems.length === 0;
		return intact ? loaded.files : undefined;
	}

	/** The notes and records of one pair of revisions. */
	private at(pins: PinnedRevisions): Pinned {
		const pair = { notes: pins.notesRevision, evidence: pins.evidenceRevision };
		const held = this.pinned.get(key(pins)) ?? {
			history: new HistoryStatusService(this.root, pair),
			built: new Map()
		};
		return recent(this.pinned, key(pins), held, most.pins);
	}

	private async read(history: HistoryStatusService, commit: string): Promise<PinnedRevision> {
		const facts = await this.facts(commit);
		// The index of a source tree is large: that of a commit beyond the last few starts anew.
		const fresh = !this.indexed.has(commit) && this.indexed.size >= most.commits;
		if (fresh) this.indexed.clear();
		if (fresh) this.sources = revisionSources(this.root);
		this.indexed.add(commit);
		const details = new RevisionDetailService(this.root, history, this.sources);
		const { detail, status } = await details.build(commit, checkedMedia);
		const note = (await history.all()).get(commit);
		const legacy = (note?.entries ?? []).flatMap((entry) =>
			entry.kind === 'legacy-report' ? [entry.id] : []
		);
		// The stored detail is what the reports explorer reads as a revision.
		const stored = detail as unknown as HarnessRevision;
		return { facts, detail: stored, judged: revisionSummary(status, detail.records), legacy };
	}
}

export type { CommitFacts, PinnedRevision } from './PinnedHistoryAdapter.types';
