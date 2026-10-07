import { readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportRepository } from '../repositories/ReportRepository';
import { EvidenceStorageService } from './EvidenceStorageService';
import { ReplayStorageService } from './ReplayStorageService';
import { atomicJson, readJson } from '../utils/reportFiles';
import { reportLock } from '../utils/reportLock';
import { reportRetention } from '../utils/reportRetention';
export interface StorageSyncOptions {
	run?: string;
	dryRun?: boolean;
}
export class ReportStorageSyncService {
	constructor(private readonly repository = new ReportRepository()) {}
	async run(options: StorageSyncOptions = {}) {
		const reports = options.run
			? [await this.repository.get(options.run)]
			: await this.repository.list();
		const result = {
			reports: [] as string[],
			evidence: 0,
			replays: 0,
			skipped: 0,
			errors: [] as string[],
			dryRun: Boolean(options.dryRun)
		};
		for (const report of reports) {
			try {
				if (reportRetention(report)) {
					result.skipped++;
					continue;
				}
				const counts = await this.sync(report.id, Boolean(options.dryRun));
				result.evidence += counts.evidence;
				result.replays += counts.replays;
				if (counts.evidence || counts.replays) result.reports.push(report.id);
			} catch (error) {
				result.errors.push(
					`${report.id}: ${error instanceof Error ? error.message : 'Storage sync failed'}`
				);
			}
		}
		return result;
	}
	private async sync(id: string, dryRun: boolean) {
		const directory = this.repository.directory(id);
		return reportLock(directory, async () => {
			const report = await this.repository.get(id);
			if (reportRetention(report)) return { evidence: 0, replays: 0 };
			const pending = report.evidence.filter((item) => !item.storage && !item.missing);
			const evidence = new Set(pending.map((item) => item.file)).size;
			const files = await this.replays(directory);
			if (!dryRun) {
				await new EvidenceStorageService().store(report, directory);
				if (evidence) await atomicJson(join(directory, 'manifest.json'), report);
				for (const file of files)
					await new ReplayStorageService().store(report, join(directory, 'replays'), file);
			}
			return { evidence, replays: files.length };
		});
	}
	private async replays(directory: string) {
		const cache = join(directory, 'replays');
		if ((await lstat(cache).catch(() => undefined))?.isSymbolicLink())
			throw new Error('Invalid replay directory');
		const files = await readdir(cache).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== 'ENOENT') throw error;
			return [] as string[];
		});
		const receipts = await readJson<Record<string, string>>(join(cache, 'storage.json')).catch(
			(error: NodeJS.ErrnoException) => {
				if (error.code !== 'ENOENT') throw error;
				return {} as Record<string, string>;
			}
		);
		return files.filter((file) => /^[a-f0-9]{64}\.mp4$/.test(file) && !receipts[file]);
	}
}
