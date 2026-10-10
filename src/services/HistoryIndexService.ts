import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EvidenceTreeAdapter } from '../adapters/EvidenceTreeAdapter';
import type { HistoryIndex, IndexedRevision, LegacyEntry } from '../core/historyIndexTypes';
import { evidenceRef, notesRef } from '../core/historyTypes';
import type { VerificationRecord } from '../core/verificationTypes';
import {
	SourceHistoryRepository,
	type SourceRevision
} from '../repositories/SourceHistoryRepository';
import { historySeries, unitGrowth } from '../utils/historySeries';
import { stableJson } from '../utils/stableJson';
import { HistoryMediaService } from './HistoryMediaService';
import { HistoryStatusService } from './HistoryStatusService';
import { RevisionDetailService, type BuiltRevision } from './RevisionDetailService';

export interface BuiltHistory {
	out: string;
	/** sha256 of `index.json`. */
	digest: string;
	media: { resolved: number; missing: number };
	problems: string[];
	index: HistoryIndex;
}

export type LegacyReader = (media: HistoryMediaService) => Promise<LegacyEntry[]>;

const unverified = 'no verification record is attached to this commit';

/**
 * Builds the history index: a deterministic, self-contained set of files made only from Git.
 * Every source commit is listed, with what proves it or the gap; media is copied in by hash.
 * The same refs always produce the same bytes, wherever and whenever the index is built.
 */
export class HistoryIndexService {
	private readonly history: HistoryStatusService;

	constructor(private readonly root: string) {
		this.history = new HistoryStatusService(root);
	}

	async build(out: string, limit: number, legacy: LegacyReader): Promise<BuiltHistory> {
		await emptied(out);
		const source = await new SourceHistoryRepository(this.root).read(limit);
		const media = new HistoryMediaService(out);
		const details = new RevisionDetailService(this.root, this.history);
		const built: Array<{ revision: SourceRevision; result: BuiltRevision }> = [];
		for (const revision of source.revisions) {
			const result = await details.build(revision.commit, media);
			await writeFile(join(out, detailPath(revision.commit)), stableJson(result.detail));
			built.push({ revision, result });
		}
		const entries = await legacy(media);
		const sound = built.flatMap((item) => item.result.sound).reverse();
		const tree = new EvidenceTreeAdapter(this.root);
		const index: HistoryIndex = {
			schemaVersion: 1,
			refs: {
				evidence: (await tree.tip(evidenceRef)) ?? null,
				notes: (await tree.tip(notesRef)) ?? null
			},
			branches: source.branches,
			revisions: built.map((item) => summary(item.revision, item.result, entries)),
			units: unitGrowth(sound),
			benchmarks: historySeries(sound),
			profiles: profiles(sound),
			legacy: entries,
			truncated: source.truncated,
			problems: problems(built, entries)
		};
		const text = stableJson(index);
		await writeFile(join(out, 'index.json'), text);
		const digest = createHash('sha256').update(text).digest('hex');
		return { out, digest, media: media.counts, problems: index.problems, index };
	}
}

/** Only what a build writes is removed, so an output directory can hold other files too. */
async function emptied(out: string): Promise<void> {
	for (const stale of ['index.json', 'revisions', 'media']) {
		await rm(join(out, stale), { recursive: true, force: true });
	}
	await mkdir(join(out, 'revisions'), { recursive: true });
}

function detailPath(commit: string): string {
	return `revisions/${commit}.json`;
}

function summary(
	revision: SourceRevision,
	built: BuiltRevision,
	legacy: LegacyEntry[]
): IndexedRevision {
	const { status, detail } = built;
	const records = status.records.map((item) => {
		const view = detail.records.find((record) => record.id === item.record);
		return {
			id: item.record,
			status: item.status,
			profile: view?.profile ?? 'unknown',
			finishedAt: view?.finishedAt ?? 'unknown',
			base: view?.source.base ?? null,
			valid: item.valid,
			problems: item.problems
		};
	});
	const usable = records.filter((record) => record.valid);
	const coverage = coverageOf(
		records.length,
		usable.map((record) => record.status)
	);
	const invalid = records
		.filter((record) => !record.valid)
		.flatMap((record) =>
			record.problems.map((problem) => `record ${short(record.id)}: ${problem}`)
		);
	return {
		...revision,
		coverage,
		gaps: records.length === 0 ? [unverified] : invalid,
		records,
		reasons: detail.explanations.length,
		legacy: legacy.filter((entry) => entry.linked === revision.commit).map((entry) => entry.id),
		detail: detailPath(revision.commit)
	};
}

/** Verified needs a usable passing record; records that cannot be used prove nothing. */
function coverageOf(attached: number, usable: string[]): IndexedRevision['coverage'] {
	if (attached === 0) return 'unverified';
	if (usable.includes('passed')) return 'verified';
	return usable.length > 0 ? 'failed' : 'invalid';
}

function profiles(records: VerificationRecord[]): HistoryIndex['profiles'] {
	const known = new Map(records.map((record) => [record.profile.id, record.profile]));
	return [...known.keys()].sort().map((id) => known.get(id) as VerificationRecord['profile']);
}

/** Every line, record or file that could not be used, named so that it can be acted on. */
function problems(
	built: Array<{ revision: SourceRevision; result: BuiltRevision }>,
	legacy: LegacyEntry[]
): string[] {
	const found = built.flatMap(({ revision, result }) => [
		...result.status.problems.map((problem) => `commit ${short(revision.commit)}: ${problem}`),
		...result.status.records.flatMap((record) =>
			record.problems.map((problem) => `record ${short(record.record)}: ${problem}`)
		)
	]);
	const media = legacy.flatMap((entry) =>
		entry.media.flatMap((item) => (item.gap ? [`legacy report ${entry.id}: ${item.gap}`] : []))
	);
	return [...new Set([...found, ...media])];
}

function short(id: string): string {
	return id.slice(0, 12);
}
