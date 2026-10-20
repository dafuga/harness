import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import type { TreeFile } from '../../../adapters/EvidenceTreeAdapter';
import { GitAdapter } from '../../../adapters/GitAdapter';
import { LfsAdapter } from '../../../adapters/LfsAdapter';
import {
	legacyDirectory,
	type EvidencePointer,
	type LegacyRecord
} from '../../../core/historyTypes';
import { EvidenceBranchRepository } from '../../../repositories/evidence-branch-repository/EvidenceBranchRepository';
import { HistoryNoteRepository } from '../../../repositories/history-note-repository/HistoryNoteRepository';
import { LegacyReportRepository } from './LegacyReportRepository';
import { sourceArchiveRef } from '../../../utils/historyRefs';
import { legacyReport } from './legacyReport';
import { type LegacyReport } from '../../../utils/legacyReport';
import { lfsPointer, lfsStored } from '../../../utils/lfsPointer';
import { stableJson } from '../../../utils/stableJson';

export interface LegacyImport {
	imported: Array<{
		id: string;
		status: string;
		startedAt: string;
		revision: string | null;
		/** The commit of this repository the recorded revision resolves to, if it does. */
		linked: string | null;
		media: number;
		created: boolean;
	}>;
	skipped: Array<{ id: string; reason: string }>;
}

/**
 * Imports the old reports of this repository into Git as they were recorded. The old store is
 * only read. Runs of other projects are skipped, a run without a resolvable revision stays
 * unlinked, and an outcome is never upgraded: `running` is imported as `running`.
 */
export class LegacyImportService {
	private readonly git: GitAdapter;
	private readonly evidence: EvidenceBranchRepository;
	private readonly notes: HistoryNoteRepository;
	private readonly lfs: LfsAdapter;

	constructor(private readonly root: string) {
		this.git = new GitAdapter(root);
		this.evidence = new EvidenceBranchRepository(root);
		this.notes = new HistoryNoteRepository(root);
		this.lfs = new LfsAdapter(root);
	}

	async import(store: string, project?: string): Promise<LegacyImport> {
		const legacy = new LegacyReportRepository(store);
		const roots = await this.roots();
		const result: LegacyImport = { imported: [], skipped: [] };
		const reports: Array<{ run: string; report: LegacyReport }> = [];
		for (const run of await legacy.runs()) {
			const report = legacyReport(run.manifest);
			if (!report) result.skipped.push({ id: run.id, reason: 'is not a report manifest' });
			else if (!mine(report, roots, project)) {
				result.skipped.push({ id: run.id, reason: 'belongs to another project' });
			} else reports.push({ run: run.id, report });
		}
		reports.sort((left, right) => (key(left.report.record) < key(right.report.record) ? -1 : 1));
		for (const { run, report } of reports) {
			result.imported.push(await this.store(legacy, run, report.record));
		}
		return result;
	}

	/** Stores one run with its files and, when its revision is a commit here, notes it there. */
	private async store(
		legacy: LegacyReportRepository,
		run: string,
		record: LegacyRecord
	): Promise<LegacyImport['imported'][number]> {
		const { files, media } = await this.assets(legacy, run, record);
		const text = stableJson({ ...record, media } satisfies LegacyRecord);
		const path = `${legacyDirectory}/${record.id}/${sha256(text).slice(0, 12)}`;
		const added = await this.evidence.add(
			path,
			[{ path: 'report.json', content: { bytes: text } }, ...files],
			`chore: import legacy report ${record.id} (${record.status})`,
			'report.json'
		);
		const linked = await this.linked(record.revision);
		const evidence = { commit: added.commit, path, manifest: sha256(text) };
		if (linked) await this.note(linked, record, evidence);
		const { id, status, startedAt, revision } = record;
		const count = media.filter((item) => item.sha256).length;
		return { id, status, startedAt, revision, linked, media: count, created: added.created };
	}

	/** Reads the run's files; one the old store no longer has stays listed without a hash. */
	private async assets(
		legacy: LegacyReportRepository,
		run: string,
		record: LegacyRecord
	): Promise<{ files: TreeFile[]; media: LegacyRecord['media'] }> {
		const files: TreeFile[] = [];
		const media: LegacyRecord['media'] = [];
		for (const item of record.media) {
			const bytes = await legacy.asset(run, item.file);
			media.push(bytes ? { ...item, sha256: sha256(bytes), bytes: bytes.length } : item);
			if (bytes) files.push(await this.file(`assets/${item.file}`, bytes));
		}
		return { files, media };
	}

	/** A run whose revision is a commit here is noted on that commit, which is then kept. */
	private async note(
		linked: string,
		record: LegacyRecord,
		evidence: EvidencePointer
	): Promise<void> {
		const { id, status, startedAt } = record;
		const line = { schemaVersion: 1 as const, kind: 'legacy-report' as const, commit: linked };
		await this.notes.append(linked, [{ ...line, id, status, startedAt, evidence }]);
		await this.git.exec(['update-ref', sourceArchiveRef(linked), linked]);
	}

	private async file(path: string, bytes: Buffer): Promise<TreeFile> {
		if (!lfsStored(path)) return { path, content: { bytes } };
		return { path, content: { bytes: lfsPointer(await this.lfs.store(bytes)) } };
	}

	/** The commit a recorded revision names in this repository; evidence commits do not count. */
	private async linked(revision: string | null): Promise<string | null> {
		if (!revision || !/^[0-9a-f]{7,40}$/.test(revision)) return null;
		const commit = await this.git.attempt([
			'rev-parse',
			'--verify',
			'--quiet',
			`${revision}^{commit}`
		]);
		return commit ?? null;
	}

	/** Paths of every working tree of this repository; a run must have been made in one. */
	private async roots(): Promise<string[]> {
		const listed = (await this.git.attempt(['worktree', 'list', '--porcelain'])) ?? '';
		const trees = listed
			.split('\n')
			.filter((line) => line.startsWith('worktree '))
			.map((line) => line.slice('worktree '.length));
		return [...new Set([this.root, ...trees])];
	}
}

function key(record: LegacyRecord): string {
	return `${record.startedAt}\n${record.id}`;
}

/** A run is ours when it was made in one of our working trees, or its project is named. */
function mine(report: LegacyReport, roots: string[], project?: string): boolean {
	const { id, name, path } = report.project;
	if (project) return project === id || project === name;
	return roots.some((root) => real(root) === real(path));
}

/** The same directory can be named through a link; compare what the names resolve to. */
function real(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}

function sha256(bytes: Buffer | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}
