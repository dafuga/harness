import { mkdir, readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import type { BeginInput, RecordInput, Report, Exports } from '../models/Report.types';
import { atomicJson, readJson, reportFiles, safeId } from '../utils/reportFiles';
import { reportLock } from '../utils/reportLock';
import { reportState, resultStatus } from '../utils/reportState';
import { reportIngest } from '../utils/reportIngest';
import { ReportRecordValidator } from '../validators/ReportRecordValidator';
import { registeredAsset } from '../utils/reportAssets';
import { EvidenceStorageService } from '../services/EvidenceStorageService';

export class ReportRepository {
	readonly root: string;
	constructor(root?: string) {
		this.root = reportFiles(root);
	}
	directory(id: string) {
		return join(this.root, 'runs', safeId(id));
	}
	async begin(input: BeginInput) {
		const run = reportState(input);
		await mkdir(this.directory(run.id), { recursive: true, mode: 0o700 });
		await atomicJson(join(this.directory(run.id), 'manifest.json'), run);
		return run;
	}
	async get(id: string): Promise<Report> {
		const directory = this.directory(id);
		if ((await lstat(directory)).isSymbolicLink()) throw new Error('Invalid report directory');
		return readJson<Report>(join(directory, 'manifest.json'));
	}
	async list() {
		const entries = await readdir(join(this.root, 'runs'), { withFileTypes: true }).catch(() => []);
		const runs = await Promise.all(
			entries
				.filter((entry) => entry.isDirectory())
				.map((entry) => this.get(entry.name).catch(() => undefined))
		);
		return runs
			.filter((run): run is Report => Boolean(run))
			.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	}
	async record(id: string, record: RecordInput) {
		ReportRecordValidator.validate(record);
		return reportLock(this.directory(id), async () => {
			const run = await this.get(id);
			if (run.state !== 'active') throw new Error('Cannot update finalizing or finalized report');
			await reportIngest(run, record, this.directory(id));
			if (record.kind === 'evidence')
				await new EvidenceStorageService().store(run, this.directory(id));
			await atomicJson(join(this.directory(id), 'manifest.json'), run);
			return run;
		});
	}
	async mutateActive(id: string, update: (run: Report, directory: string) => Promise<void>) {
		return reportLock(this.directory(id), async () => {
			const run = await this.get(id);
			if (run.state !== 'active') throw new Error('Cannot update finalizing or finalized report');
			await update(run, this.directory(id));
			await new EvidenceStorageService().store(run, this.directory(id));
			await atomicJson(join(this.directory(id), 'manifest.json'), run);
			return run;
		});
	}
	async seal(id: string) {
		return reportLock(this.directory(id), async () => {
			const run = await this.get(id);
			if (run.state === 'finalized') throw new Error('Report is already finalized');
			for (const item of run.evidence) {
				try {
					await registeredAsset(
						join(this.directory(id), 'assets'),
						item.file,
						run.evidence.map((value) => value.file)
					);
				} catch {
					item.missing = true;
					item.status = 'not-proven';
					item.note = `${item.note || ''} Evidence unavailable at finalization.`.trim();
				}
			}
			run.state = 'finalizing';
			run.status = resultStatus(run);
			run.updatedAt = new Date().toISOString();
			await atomicJson(join(this.directory(id), 'manifest.json'), run);
			return run;
		});
	}
	async finish(id: string, exports: Exports) {
		return reportLock(this.directory(id), async () => {
			const run = await this.get(id);
			if (run.state !== 'finalizing') throw new Error('Report must be finalizing');
			run.state = 'finalized';
			run.exports = exports;
			run.updatedAt = new Date().toISOString();
			await atomicJson(join(this.directory(id), 'manifest.json'), run);
			return run;
		});
	}
}
