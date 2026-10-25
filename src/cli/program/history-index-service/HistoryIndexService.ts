import type { LegacyReader, BuiltHistory, Built } from './HistoryIndexService.types';
import { createHash } from 'node:crypto';
import { SourceArchiveService } from './SourceArchiveService';
import { activityDetails, compactRevision, storedSnapshots } from './historySnapshots';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { EvidenceTreeAdapter } from '../../../adapters/verification-evidence/EvidenceTreeAdapter';
import type {
	HistoryIndex,
	IndexedRevision,
	LegacyEntry
} from '../../../core/git-source-history/historyIndexTypes';
import { evidenceRef, notesRef } from '../../../core/git-source-history/historyTypes';
import type { BudgetEvent } from '../../../core/verification-evidence/budgetTypes';
import type { VerificationRecord } from '../../../core/verification-evidence/verificationTypes';
import {
	SourceHistoryRepository,
	type SourceRevision
} from '../../../repositories/git-source-history/source-history-repository/SourceHistoryRepository';
import { budgetReviews } from './budgetReviews';
import { historySeries, unitGrowth } from './historySeries';
import { revisionChanges } from './revisionChanges';
import type {
	RevisionChanges,
	UnitVersions
} from '../../../utils/development-tooling/revisionChanges';
import { revisionSummary } from '../../../utils/development-tooling/revisionSummary';
import { stableJson } from '../../../utils/development-tooling/stableJson';
import { HistoryMediaService } from './history-media-service/HistoryMediaService';
import { HistoryStatusService } from '../../../services/verification-evidence/history-status-service/HistoryStatusService';
import { ProjectActivityService } from '../../../services/projects-sessions/project-activity-service/ProjectActivityService';
import { CatalogIndexService } from '../../../services/git-source-history/CatalogIndexService';
import { RevisionDetailService } from '../../../services/explorer-ui/revision-detail-service/RevisionDetailService';

/**
 * Builds the history index: a deterministic, self-contained set of files made only from Git.
 * Every source commit is listed, with what proves it or the gap; media is copied in by hash.
 * The same refs and repository URL produce the same bytes wherever the index is built.
 */
export class HistoryIndexService {
	private readonly history: HistoryStatusService;

	constructor(private readonly root: string) {
		this.history = new HistoryStatusService(root);
	}

	/** Writes the detail of each revision, and the stored side of each distinct source tree. */
	private async revisions(
		out: string,
		revisions: SourceRevision[],
		media: HistoryMediaService
	): Promise<Built> {
		const details = new RevisionDetailService(this.root, this.history);
		const sources = new SourceArchiveService(this.root, out);
		const built: Built = [];
		const events = new Map<string, BudgetEvent>();
		const sides = new Set<string>();
		for (const revision of revisions) {
			const result = await details.build(revision.commit, media);
			await sources.archive(
				revision.commit,
				result.detail.registry.units,
				result.side ?? undefined
			);
			await writeFile(join(out, detailPath(revision.commit)), stableJson(result.detail));
			// One stored side per source tree: what any two revisions are compared from.
			if (result.side && result.detail.side && !sides.has(result.detail.side)) {
				sides.add(result.detail.side);
				await writeFile(join(out, result.detail.side), stableJson(result.side));
			}
			built.push({ revision, result: compactRevision(result, events) });
		}
		return built;
	}

	/** Git origin is navigation metadata; only canonical GitHub addresses are published. */
	private async sourceRepository(): Promise<string | undefined> {
		const origin = await new GitAdapter(this.root).attempt(['remote', 'get-url', 'origin']);
		const match =
			/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(
				origin ?? ''
			);
		return match ? `https://github.com/${match[1]}` : undefined;
	}

	async build(out: string, limit: number, legacy: LegacyReader): Promise<BuiltHistory> {
		await emptied(out);
		const source = await new SourceHistoryRepository(this.root).read(limit);
		const media = new HistoryMediaService(out);
		const built = await this.revisions(out, source.revisions, media);
		const entries = await legacy(media);
		const sound = built.flatMap((item) => item.result.sound).reverse();
		const tree = new EvidenceTreeAdapter(this.root);
		const index: HistoryIndex = {
			schemaVersion: 1,
			sourceRepository: await this.sourceRepository(),
			refs: {
				evidence: (await tree.tip(evidenceRef)) ?? null,
				notes: (await tree.tip(notesRef)) ?? null
			},
			branches: source.branches,
			revisions: summaries(built, entries),
			units: unitGrowth(sound, budgetReviews(built.map((item) => item.result.ledger).reverse())),
			benchmarks: historySeries(sound, focusedRuns(built)),
			profiles: profiles(sound),
			legacy: entries,
			truncated: source.truncated,
			problems: problems(built, entries)
		};
		const text = stableJson(index);
		await writeFile(join(out, 'index.json'), text);
		// What the project did, beside the index: recent work, changed files and loop types.
		const details = activityDetails(out, built);
		const activity = await new ProjectActivityService(this.root).recorded(source, details);
		await writeFile(join(out, 'activity.json'), stableJson(activity));
		const digest = createHash('sha256').update(text).digest('hex');
		const catalog = await new CatalogIndexService().write(out, index, storedSnapshots(out, built));
		return { out, digest, media: media.counts, problems: index.problems, index, catalog };
	}
}

/** Only what a build writes is removed, so an output directory can hold other files too. */
async function emptied(out: string): Promise<void> {
	for (const stale of ['index.json', 'activity.json', 'revisions', 'sides', 'media']) {
		await rm(join(out, stale), { recursive: true, force: true });
	}
	await mkdir(join(out, 'revisions'), { recursive: true });
	await mkdir(join(out, 'sides'), { recursive: true });
}

function detailPath(commit: string): string {
	return `revisions/${commit}.json`;
}

function focusedRuns(built: Built) {
	return built.flatMap(({ result }) => result.detail.regressions ?? []);
}

/** Each built revision as the index lists it, with what its commit changed against its parent. */
function summaries(built: Built, legacy: LegacyEntry[]): IndexedRevision[] {
	const registries = new Map(
		built.map((item) => [item.revision.commit, item.result.detail.registry])
	);
	return built.map((item) =>
		summary(item.revision, item.result, legacy, changed(item, registries))
	);
}

/** What a commit changed itself, from its stored impact and the registry of its first parent. */
function changed(
	item: Built[number],
	registries: Map<string, UnitVersions>
): RevisionChanges | null {
	const base = item.revision.parents[0] ?? null;
	const { sourceImpact, registry } = item.result.detail;
	const parent = base === null ? undefined : registries.get(base);
	return revisionChanges({ impact: sourceImpact, registry, parent, base });
}

function summary(
	revision: SourceRevision,
	built: Built[number]['result'],
	legacy: LegacyEntry[],
	changes: RevisionChanges | null
): IndexedRevision {
	const { status, detail } = built;
	return {
		...revision,
		...revisionSummary(status, detail.records),
		reasons: detail.explanations.length,
		legacy: legacy.filter((entry) => entry.linked === revision.commit).map((entry) => entry.id),
		changes,
		detail: detailPath(revision.commit)
	};
}

function profiles(records: VerificationRecord[]): HistoryIndex['profiles'] {
	const known = new Map(records.map((record) => [record.profile.id, record.profile]));
	return [...known.keys()].sort().map((id) => known.get(id) as VerificationRecord['profile']);
}

/** Every line, record or file that could not be used, named so that it can be acted on. */
function problems(built: Built, legacy: LegacyEntry[]): string[] {
	const found = built.flatMap(({ revision, result }) => [
		...result.status.problems.map((problem) => `commit ${short(revision.commit)}: ${problem}`),
		...(result.detail.regressions ?? []).flatMap((proof) =>
			proof.gap ? [`regression ${proof.loop} at ${short(revision.commit)}: ${proof.gap}`] : []
		),
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

export type { BuiltHistory, LegacyReader } from './HistoryIndexService.types';
