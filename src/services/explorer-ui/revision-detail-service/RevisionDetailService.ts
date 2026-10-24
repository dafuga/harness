import { translationCatalog } from './translationCatalog';
import type { Stored, BuiltRevision, RevisionDetail } from './RevisionDetailService.types';
import { BudgetLedgerRepository } from '../../../repositories/BudgetLedgerRepository';
import { BudgetService } from '../../budget-service/BudgetService';
import { CommitTreeAdapter } from '../../../adapters/CommitTreeAdapter';
import { GitAdapter } from '../../../adapters/GitAdapter';
import type { VerificationRecord } from '../../../core/verificationTypes';
import { ScenarioRepository } from '../../../repositories/ScenarioRepository';
import { UnitRegistryRepository } from '../../../repositories/UnitRegistryRepository';
import type { MediaPlacer } from '../../../utils/mediaPlace';
import { recordView, type RecordView, type ResolvedMedia } from '../../../utils/recordView';
import { revisionReasons, type RevisionReasons } from '../../../utils/revisionReasons';
import { revisionRegistry, type RevisionRegistry } from '../../../utils/revisionRegistry';
import type { AttachedRecord } from '../../history-status-service/attached-record-service/AttachedRecordService';
import type { HistoryStatusService } from '../../history-status-service/HistoryStatusService';
import * as sourceImpact from './source-impact-service/SourceImpactService';
import { RegressionProofRepository } from '../../../repositories/RegressionProofRepository';
import { unitMetadata } from './unitMetadata';
import { readPlatformCatalog } from './platformCatalog';
import { projectDependencies } from './projectDependencies';
/** What the source of a commit says, whatever is noted on it: shared, it is read only once. */
export const revisionSources = (root: string) => ({
	source: new sourceImpact.SourceImpactService(root),
	registries: new Map<string, Stored>()
});
/** A commit's own registry, records and reasons, with captures placed by the caller. */
export class RevisionDetailService {
	private readonly git: GitAdapter;
	constructor(
		private readonly root: string,
		private readonly history: HistoryStatusService,
		private readonly kept = revisionSources(root)
	) {
		this.git = new GitAdapter(root);
	}
	async build(commit: string, media: MediaPlacer): Promise<BuiltRevision> {
		const status = await this.history.status(commit);
		const records: RecordView[] = [];
		const sound: VerificationRecord[] = [];
		for (const item of status.records) {
			const loaded = await this.history.attached.load(item.evidence);
			if (!loaded.record) continue;
			const resolved = await this.media(loaded, media);
			const ran = await this.ran(loaded.record);
			const resolve = (capture: { path: string }, origin: string): ResolvedMedia =>
				resolved.get(`${origin}\n${capture.path}`) ?? { media: null, gap: 'not resolved' };
			const context = { valid: item.valid, problems: item.problems, resolve };
			records.push(recordView(loaded.record, { ...context, origins: (id) => ran.get(id) }));
			if (item.valid) sound.push(loaded.record);
		}
		const side = await this.kept.source.stored(commit);
		const tree = await this.git.attempt(['rev-parse', '--verify', '--quiet', `${commit}^{tree}`]);
		const stored = await this.registry(commit);
		await this.sourceMeasures(commit, stored.registry);
		const reasons = await this.reasons(commit, sound);
		const detail: RevisionDetail = {
			schemaVersion: 1,
			commit,
			...catalogFields(stored),
			registry: stored.registry,
			comparison: comparison(sound),
			sourceImpact: (await this.kept.source.of(commit)) ?? null,
			side: side && tree ? `sides/${tree}.json` : null,
			records,
			explanations: reasons.explanations,
			rangeReasons: reasons.range,
			regressions: await regressionProofs(this.root, this.history, commit, media)
		};
		return { detail, status, sound, ledger: stored.ledger, ...(side ? { side } : {}) };
	}
	private async sourceMeasures(commit: string, registry: RevisionRegistry): Promise<void> {
		const measured = await this.kept.source.measurements(commit);
		for (const unit of registry.units) {
			unit.sourceMeasurements = measured.filter((item) => item.unit === unit.id);
		}
	}
	/** Every capture is looked up in the record that produced it, which may be an earlier one. */
	private async media(
		loaded: AttachedRecord,
		media: MediaPlacer
	): Promise<Map<string, ResolvedMedia>> {
		const resolved = new Map<string, ResolvedMedia>();
		const own = loaded.record?.id ?? '';
		for (const scenario of loaded.record?.scenarios ?? []) {
			const origin = scenario.referencedRecord ?? own;
			const source = origin === own ? loaded : await this.origin(origin);
			for (const capture of scenario.states.flatMap((state) => state.captures)) {
				const bytes = source?.files.get(capture.path);
				const placed = await media.place(bytes, capture, gapFor(source, capture.path, origin));
				resolved.set(`${origin}\n${capture.path}`, placed);
			}
		}
		return resolved;
	}
	/** The checks each record that this one inherits from ran, for the origins that can be read. */
	private async ran(record: VerificationRecord): Promise<Map<string, VerificationRecord['tests']>> {
		const origins = new Set(record.scenarios.flatMap((item) => item.referencedRecord ?? []));
		const found = new Map<string, VerificationRecord['tests']>();
		for (const id of origins) {
			const origin = (await this.origin(id))?.record;
			if (origin) found.set(id, origin.tests);
		}
		return found;
	}
	/** The attached record with this id, wherever in history it was attached. */
	private async origin(id: string): Promise<AttachedRecord | undefined> {
		const line = (await this.history.verifications()).find((item) => item.record === id);
		return line ? this.history.attached.load(line.evidence) : undefined;
	}
	/** Revisions with one tree share its registry and frozen budget ledger. */
	private async registry(commit: string): Promise<Stored> {
		const key =
			(await this.git.attempt(['rev-parse', '--verify', '--quiet', `${commit}^{tree}`])) ?? commit;
		const known = this.kept.registries.get(key);
		if (known) return known;
		const tree = await CommitTreeAdapter.open(this.root, commit);
		const units = await new UnitRegistryRepository(this.root).read(tree);
		const scenarios = await new ScenarioRepository(this.root).read(tree);
		const blobs = new Map((await tree.list()).map((entry) => [entry.path, entry.hash]));
		const ledger = (await new BudgetLedgerRepository(this.root).read(tree)).events;
		const limits = new BudgetService().baselines(ledger, units.manifests);
		const registry = revisionRegistry(units.manifests, scenarios.manifests, blobs, limits);
		await unitMetadata(tree, registry.units);
		const stored = {
			registry,
			ledger,
			platforms: await readPlatformCatalog(tree),
			projectDependencies: await projectDependencies(tree),
			translations: await translationCatalog(tree, registry.units)
		};
		this.kept.registries.set(key, stored);
		return stored;
	}
	/** Reasons of this commit itself, excluding the earlier commits of a verified range. */
	private async reasons(commit: string, sound: VerificationRecord[]): Promise<RevisionReasons> {
		const note = (await this.history.all()).get(commit);
		const noted = (note?.entries ?? []).flatMap((entry) =>
			entry.kind === 'reason' ? [entry.explanation] : []
		);
		const records = sound.map((record) => ({
			base: record.source.base,
			entries: record.reasons.entries ?? []
		}));
		const parent = (await this.kept.source.parent(commit)) ?? null;
		return revisionReasons({ parent, own: await this.kept.source.reasons(commit), noted, records });
	}
}
/** Why the bytes of a capture are not available, in the words of what is wrong with them. */
function gapFor(source: AttachedRecord | undefined, path: string, origin: string): string {
	if (!source) return `inherited record ${short(origin)} is not available`;
	const named = source.problems.find((problem) => problem.includes(path));
	return named ?? `${path} is not part of record ${short(origin)}`;
}
function comparison(sound: VerificationRecord[]): RevisionDetail['comparison'] {
	const record = sound.find((item) => item.status === 'passed') ?? sound[0];
	if (!record) return null;
	const { units, changed, uncertain } = record.impact;
	const scenarios = record.scenarios
		.filter((scenario) => scenario.status !== 'referenced')
		.map((scenario) => scenario.id);
	return { base: record.source.base, record: record.id, units, changed, scenarios, uncertain };
}
const short = (id: string): string => id.slice(0, 12);
async function regressionProofs(
	root: string,
	history: HistoryStatusService,
	commit: string,
	media: MediaPlacer
) {
	const repository = new RegressionProofRepository(root, history.pinned?.evidence);
	return repository.history(commit, await history.all(), media);
}

export type { RevisionDetail, BuiltRevision } from './RevisionDetailService.types';

function catalogFields(stored: Stored) {
	return {
		platforms: stored.platforms,
		translations: stored.translations,
		projectDependencies: stored.projectDependencies
	};
}
