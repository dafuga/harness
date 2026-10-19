import { EvidenceTreeAdapter } from '../adapters/EvidenceTreeAdapter';
import { evidenceRef, type HistoryNote } from '../core/historyTypes';
import { fail } from '../core/errors';
import type { RegressionRecord } from '../core/regressionTypes';
import { readRegression, regressionHash } from '../utils/regressionHistory';
import { canonicalJson } from '../utils/canonicalJson';
import { sourceArchiveRef } from '../utils/historyRefs';
import type { ReadNote } from "../utils/note-lines/noteLines";
import { EvidenceBranchRepository } from "./evidence-branch-repository/EvidenceBranchRepository";
import { HistoryNoteRepository } from "./history-note-repository/HistoryNoteRepository";

export type RegressionNote = Extract<HistoryNote, { kind: 'regression' }>;

/** Append-only checkpoints share Harness's existing evidence branch, notes and archive refs. */
export class RegressionProofRepository {
	constructor(
		private readonly root: string,
		private readonly within?: string | null
	) {}

	async save(record: RegressionRecord, output: Buffer): Promise<void> {
		const json = canonicalJson(record);
		const path = `regressions/${record.source.commit}/${record.id}`;
		const manifest = canonicalJson({ record: regressionHash(json), log: regressionHash(output) });
		const added = await new EvidenceBranchRepository(this.root).add(
			path,
			[
				{ path: 'record.json', content: { bytes: json } },
				{ path: 'output.log', content: { bytes: output } },
				{ path: 'manifest.json', content: { bytes: manifest } }
			],
			`chore: record ${record.phase} regression ${record.source.commit.slice(0, 7)}`,
			'manifest.json'
		);
		await new HistoryNoteRepository(this.root).append(record.source.commit, [
			regressionNote(record, added.commit, path, manifest)
		]);
		await new EvidenceTreeAdapter(this.root).git.run([
			'update-ref',
			sourceArchiveRef(record.source.commit),
			record.source.commit
		]);
	}

	/** Reading is pinned to the supplied note map; a copied or corrupt checkpoint is refused. */
	async load(note: RegressionNote): Promise<{ record: RegressionRecord; output: string }> {
		const tree = new EvidenceTreeAdapter(this.root);
		const within = this.within === undefined ? await tree.tip(evidenceRef) : this.within;
		if (!within || !(await tree.contains(within, note.evidence.commit)))
			return fail('Regression evidence is outside the pinned evidence history.');
		const loaded = await readRegression(note, async (path) =>
			tree.read(note.evidence.commit, `${note.evidence.path}/${path}`)
		);
		const source = await tree.git.run(['rev-parse', `${note.commit}^{tree}`]);
		if (source !== loaded.record.source.tree)
			return fail('Regression evidence has the wrong source tree.');
		return loaded;
	}

	async latest(
		loop: string,
		phase: 'red' | 'green',
		commit: string
	): Promise<RegressionNote | undefined> {
		const notes = await new HistoryNoteRepository(this.root).all();
		const candidates = regressionNotes(notes).filter(
			(note) => note.loop === loop && note.phase === phase
		);
		const history = (await new EvidenceTreeAdapter(this.root).git.run(['rev-list', commit])).split(
			'\n'
		);
		const ancestor = history.find((hash) => candidates.some((note) => note.commit === hash));
		let latest: { note: RegressionNote; at: string } | undefined;
		for (const note of candidates.filter((item) => item.commit === ancestor)) {
			const at = (await this.load(note)).record.finishedAt;
			if (!latest || at > latest.at) latest = { note, at };
		}
		return latest?.note;
	}
}

export const regressionNotes = (notes: Map<string, ReadNote>): RegressionNote[] =>
	[...notes.values()].flatMap((note) =>
		note.entries.filter((entry): entry is RegressionNote => entry.kind === 'regression')
	);

function regressionNote(
	record: RegressionRecord,
	evidence: string,
	path: string,
	manifest: string
): RegressionNote {
	return {
		schemaVersion: 1,
		kind: 'regression',
		commit: record.source.commit,
		loop: record.loop,
		phase: record.phase,
		record: record.id,
		evidence: { commit: evidence, path, manifest: regressionHash(manifest) }
	};
}
