import { CommitTreeAdapter } from '../adapters/CommitTreeAdapter';
import { GitAdapter } from '../adapters/GitAdapter';
import type { Explanation } from '../core/explanationTypes';
import type { VerificationRecord } from '../core/verificationTypes';
import { ScenarioRepository } from '../repositories/ScenarioRepository';
import { UnitRegistryRepository } from '../repositories/UnitRegistryRepository';
import { canonicalJson } from '../utils/canonicalJson';
import { recordView, type RecordView, type ResolvedMedia } from '../utils/recordView';
import { revisionRegistry, type RevisionRegistry } from '../utils/revisionRegistry';
import type { AttachedRecord } from './AttachedRecordService';
import type { HistoryMediaService } from './HistoryMediaService';
import type { CommitStatus, HistoryStatusService } from './HistoryStatusService';
import type { StoredSide } from '../utils/sideImpact';
import { SourceImpactService, type SourceImpact } from './SourceImpactService';

export interface RevisionDetail {
	schemaVersion: 1;
	commit: string;
	registry: RevisionRegistry;
	/** What the latest usable record compared this revision with, as that record stated it. */
	comparison: {
		base: string | null;
		record: string;
		units: VerificationRecord['impact']['units'];
		changed: VerificationRecord['impact']['changed'];
		/** Scenarios this record tested afresh because the change reached them. */
		scenarios: string[];
		/** References the impact analysis could not resolve, which widened what was rerun. */
		uncertain: VerificationRecord['impact']['uncertain'];
	} | null;
	/**
	 * What the commit changed against its first parent, computed from the source of both commits.
	 * It exists whether or not anything was verified; null when a tree could not be read.
	 */
	sourceImpact: SourceImpact | null;
	/**
	 * Where the stored side of this revision's source tree is, relative to the index: what any
	 * two revisions are compared from. Null when the tree could not be read.
	 */
	side: string | null;
	records: RecordView[];
	explanations: Explanation[];
}

export interface BuiltRevision {
	detail: RevisionDetail;
	/** The stored side to write at `detail.side`; revisions with one tree share one. */
	side?: StoredSide;
	status: CommitStatus;
	/** Attached records of this commit that are intact, whatever their outcome. */
	sound: VerificationRecord[];
}

/**
 * Everything the history shows for one commit, taken from what is stored for that commit: its
 * own registry, the records attached to it and the reasons noted on it. Nothing is recomputed
 * from, or replaced by, the current state of the repository.
 */
export class RevisionDetailService {
	private readonly registries = new Map<string, RevisionRegistry>();
	private readonly git: GitAdapter;
	private readonly source: SourceImpactService;

	constructor(
		private readonly root: string,
		private readonly history: HistoryStatusService
	) {
		this.git = new GitAdapter(root);
		this.source = new SourceImpactService(root);
	}

	async build(commit: string, media: HistoryMediaService): Promise<BuiltRevision> {
		const status = await this.history.status(commit);
		const records: RecordView[] = [];
		const sound: VerificationRecord[] = [];
		for (const item of status.records) {
			const loaded = await this.history.attached.load(item.evidence);
			if (!loaded.record) continue;
			const resolved = await this.media(loaded, media);
			const resolve = (capture: { path: string }, origin: string): ResolvedMedia =>
				resolved.get(`${origin}\n${capture.path}`) ?? { media: null, gap: 'not resolved' };
			records.push(
				recordView(loaded.record, { valid: item.valid, problems: item.problems, resolve })
			);
			if (item.valid) sound.push(loaded.record);
		}
		const side = await this.source.stored(commit);
		const tree = await this.git.attempt(['rev-parse', '--verify', '--quiet', `${commit}^{tree}`]);
		const detail: RevisionDetail = {
			schemaVersion: 1,
			commit,
			registry: await this.registry(commit),
			comparison: comparison(sound),
			sourceImpact: (await this.source.of(commit)) ?? null,
			side: side && tree ? `sides/${tree}.json` : null,
			records,
			explanations: await this.explanations(commit, sound)
		};
		return { detail, status, sound, ...(side ? { side } : {}) };
	}

	/** Every capture is looked up in the record that produced it, which may be an earlier one. */
	private async media(
		loaded: AttachedRecord,
		media: HistoryMediaService
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

	/** The attached record with this id, wherever in history it was attached. */
	private async origin(id: string): Promise<AttachedRecord | undefined> {
		const line = (await this.history.verifications()).find((item) => item.record === id);
		return line ? this.history.attached.load(line.evidence) : undefined;
	}

	/** Revisions with the same tree share one parsed registry. */
	private async registry(commit: string): Promise<RevisionRegistry> {
		// Unit versions cover owned files, so the whole tree identifies a registry view.
		const key =
			(await this.git.attempt(['rev-parse', '--verify', '--quiet', `${commit}^{tree}`])) ?? commit;
		const known = this.registries.get(key);
		if (known) return known;
		const tree = await CommitTreeAdapter.open(this.root, commit);
		const units = await new UnitRegistryRepository(this.root).read(tree);
		const scenarios = await new ScenarioRepository(this.root).read(tree);
		const blobs = new Map((await tree.list()).map((entry) => [entry.path, entry.hash]));
		const registry = revisionRegistry(units.manifests, scenarios.manifests, blobs);
		this.registries.set(key, registry);
		return registry;
	}

	/** Reasons noted on the commit and those that satisfied its records, each listed once. */
	private async explanations(commit: string, sound: VerificationRecord[]): Promise<Explanation[]> {
		const note = (await this.history.all()).get(commit);
		const noted = (note?.entries ?? []).flatMap((entry) =>
			entry.kind === 'reason' ? [entry.explanation] : []
		);
		const used = sound.flatMap((record) => record.reasons.entries ?? []);
		const unique = new Map([...noted, ...used].map((entry) => [canonicalJson(entry), entry]));
		return [...unique.keys()].sort().map((key) => unique.get(key) as Explanation);
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

function short(id: string): string {
	return id.slice(0, 12);
}
