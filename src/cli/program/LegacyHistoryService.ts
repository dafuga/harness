import { EvidenceTreeAdapter } from '../../adapters/verification-evidence/EvidenceTreeAdapter';
import { LfsAdapter } from '../../adapters/git-source-history/LfsAdapter';
import type { LegacyEntry, LegacyMedia } from '../../core/git-source-history/historyIndexTypes';
import {
	evidenceRef,
	legacyDirectory,
	legacyRecordSchema,
	type LegacyRecord
} from '../../core/git-source-history/historyTypes';
import { lfsStored } from '../../utils/verification-evidence/lfsPointer';
import type { HistoryMediaService } from './history-index-service/history-media-service/HistoryMediaService';

/**
 * Reads the imported legacy reports for the history index. Each run is shown as recorded; a
 * revision that is not a commit here leaves the run unlinked, with the reason stated.
 */
export class LegacyHistoryService {
	private readonly tree: EvidenceTreeAdapter;
	private readonly lfs: LfsAdapter;

	constructor(root: string) {
		this.tree = new EvidenceTreeAdapter(root);
		this.lfs = new LfsAdapter(root);
	}

	async entries(media: HistoryMediaService): Promise<LegacyEntry[]> {
		const tip = await this.tree.tip(evidenceRef);
		if (!tip) return [];
		const reports = [...(await this.tree.list(tip)).keys()].filter((path) =>
			new RegExp(`^${legacyDirectory}/[^/]+/[^/]+/report\\.json$`).test(path)
		);
		const latest = new Map<string, { record: LegacyRecord; directory: string }>();
		for (const path of reports.sort()) {
			const bytes = await this.tree.read(tip, path);
			const parsed = legacyRecordSchema.safeParse(parseJson(bytes));
			if (!parsed.success) continue;
			const known = latest.get(parsed.data.id);
			if (known && known.record.updatedAt > parsed.data.updatedAt) continue;
			latest.set(parsed.data.id, {
				record: parsed.data,
				directory: path.slice(0, -'/report.json'.length)
			});
		}
		const entries: LegacyEntry[] = [];
		for (const { record, directory } of latest.values()) {
			entries.push(await this.entry(tip, directory, record, media));
		}
		return entries.sort((left, right) =>
			`${left.startedAt}\n${left.id}` < `${right.startedAt}\n${right.id}` ? -1 : 1
		);
	}

	private async entry(
		tip: string,
		directory: string,
		record: LegacyRecord,
		media: HistoryMediaService
	): Promise<LegacyEntry> {
		const { id, title, mode, environment, status, state, startedAt, updatedAt } = record;
		const shown = { id, title, mode, environment, status, state, startedAt, updatedAt };
		const files: LegacyMedia[] = [];
		for (const item of record.media) files.push(await this.media(tip, directory, item, media));
		const linked = await this.linked(record.revision);
		const gap = record.revision
			? `recorded revision ${record.revision} is not a commit in this repository`
			: 'no tested revision was recorded';
		const { revision, summary, checks } = record;
		const recorded = { ...shown, revision, summary, checks };
		return { ...recorded, linked, ...(linked ? {} : { gap }), media: files };
	}

	private async media(
		tip: string,
		directory: string,
		item: LegacyRecord['media'][number],
		media: HistoryMediaService
	): Promise<LegacyMedia> {
		if (!item.sha256) {
			return { ...item, media: null, gap: `asset ${item.file} was not in the legacy store` };
		}
		const path = `${directory}/assets/${item.file}`;
		const bytes = lfsStored(path)
			? await this.lfs.read(item.sha256)
			: await this.tree.read(tip, path);
		const gap = `media ${item.file} is not available locally; run harness history fetch`;
		const placed = await media.place(bytes, { path: item.file, sha256: item.sha256 }, gap);
		return { ...item, ...placed };
	}

	private async linked(revision: string | null): Promise<string | null> {
		if (!revision || !/^[0-9a-f]{7,40}$/.test(revision)) return null;
		const found = await this.tree.git.attempt([
			'rev-parse',
			'--verify',
			'--quiet',
			`${revision}^{commit}`
		]);
		return found ?? null;
	}
}

function parseJson(bytes: Buffer | undefined): unknown {
	try {
		return JSON.parse(bytes?.toString('utf8') ?? '') as unknown;
	} catch {
		return undefined;
	}
}
