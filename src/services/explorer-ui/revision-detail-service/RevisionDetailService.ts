import { revisionRegistryAt, revisionReasonsAt } from './revisionStoredData';
import {
	preparedModuleData,
	committedRegistry
} from '../../git-source-history/module-data-service/preparedModuleData';
import type { Stored, BuiltRevision, RevisionDetail } from './RevisionDetailService.types';
import { GitAdapter } from '../../../adapters/GitAdapter';
import type { VerificationRecord } from '../../../core/verificationTypes';
import type { MediaPlacer } from '../../../utils/mediaPlace';
import { recordView, type RecordView, type ResolvedMedia } from '../../../utils/recordView';
import type { RevisionRegistry } from '../../../utils/revisionRegistry';
import type { AttachedRecord } from '../../history-status-service/attached-record-service/AttachedRecordService';
import type { HistoryStatusService } from '../../history-status-service/HistoryStatusService';
import * as sourceImpact from './source-impact-service/SourceImpactService';
import { RegressionProofRepository } from '../../../repositories/RegressionProofRepository';
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
	async build(
		commit: string,
		media: MediaPlacer,
		includeModuleData = true
	): Promise<BuiltRevision> {
		const { status, records, sound } = await this.recorded(commit, media);
		const side = await this.kept.source.stored(commit);
		const tree = await this.git.attempt(['rev-parse', '--verify', '--quiet', `${commit}^{tree}`]);
		const stored = await revisionRegistryAt(this.root, commit, this.kept);
		await this.sourceMeasures(commit, stored.registry);
		const reasons = await revisionReasonsAt(commit, sound, this.kept, this.history);
		const detail: RevisionDetail = {
			schemaVersion: 1,
			commit,
			...catalogFields(stored),
			registry: includeModuleData
				? await committedRegistry(this.root, commit, stored.registry)
				: stored.registry,
			...(includeModuleData ? { moduleData: await preparedModuleData(this.root, commit) } : {}),
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
	async recorded(commit: string, media: MediaPlacer) {
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
		return { status, records, sound };
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
