import type { RegressionNote } from './RegressionProofRepository.types';
import { EvidenceTreeAdapter } from '../../adapters/verification-evidence/EvidenceTreeAdapter';
import { evidenceRef } from '../../core/git-source-history/historyTypes';
import { fail } from '../../core/development-tooling/errors';
import type { RegressionRecord } from '../../core/verification-evidence/regressionTypes';
import {
	readRegression,
	regressionHash,
	regressionHistory
} from '../../utils/git-source-history/regressionHistory';
import type { MediaPlacer } from '../../utils/development-tooling/mediaPlace';
import { canonicalJson } from '../../utils/development-tooling/canonicalJson';
import { sourceArchiveRef } from '../../utils/git-source-history/historyRefs';
import type { ReadNote } from '../../utils/git-source-history/note-lines/noteCommit';
import { EvidenceBranchRepository } from './evidence-branch-repository/EvidenceBranchRepository';
import { HistoryNoteRepository } from '../git-source-history/history-note-repository/HistoryNoteRepository';

/** Append-only checkpoints share Harness's existing evidence branch, notes and archive refs. */
export class RegressionProofRepository {
	constructor(
		private readonly root: string,
		private readonly within?: string | null
	) {}

	/** Squash commits may reuse sealed pixels only when their entire source trees are identical. */
	async history(commit: string, notes: Map<string, ReadNote>, media: MediaPlacer) {
		const git = new EvidenceTreeAdapter(this.root).git;
		const target = await git.run(['rev-parse', `${commit}^{tree}`]);
		const candidates = [
			...new Set(
				regressionNotes(notes)
					.filter((note) => note.phase !== 'red' && note.commit !== commit)
					.map((note) => note.commit)
			)
		];
		const trees = candidates.length
			? (
					await git.run(['cat-file', '--batch-check=%(objectname) %(objecttype)'], {
						input: candidates.map((id) => `${id}^{tree}\n`).join('')
					})
				).split('\n')
			: [];
		const identical = candidates.filter((_, index) => trees[index] === `${target} tree`);
		const origins = [commit, ...identical];
		return (
			await Promise.all(
				origins.map((origin) => regressionHistory(origin, notes, this.load.bind(this), media))
			)
		).flat();
	}

	async save(
		record: RegressionRecord,
		output: Buffer,
		files: Array<{ path: string; bytes: Buffer }> = []
	): Promise<void> {
		const json = canonicalJson(record);
		const path = `regressions/${record.source.commit}/${record.id}`;
		const manifest = canonicalJson({ record: regressionHash(json), log: regressionHash(output) });
		const added = await new EvidenceBranchRepository(this.root).add(
			path,
			[
				{ path: 'record.json', content: { bytes: json } },
				{ path: 'output.log', content: { bytes: output } },
				{ path: 'manifest.json', content: { bytes: manifest } },
				...files.map(({ path, bytes }) => ({ path, content: { bytes } }))
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
	async load(note: RegressionNote) {
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

export type { RegressionNote } from './RegressionProofRepository.types';
