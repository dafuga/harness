import { lstat, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportRepository } from '../repositories/ReportRepository';
import { ReportExportService } from './ReportExportService';
import { atomicJson } from '../utils/reportFiles';
import { reportLock } from '../utils/reportLock';
import { resultStatus } from '../utils/reportState';
import { r2ObjectKey } from '../adapters/R2ScreenshotStoreAdapter';
import type { Evidence, Report } from '../models/Report.types';

const retentionMs = 30 * 24 * 60 * 60 * 1000;
function expired(item: Evidence, report: Report, cutoff: number) {
	const captured = Date.parse(item.capturedAt || report.startedAt);
	return item.storage === 'r2' && !item.missing && Number.isFinite(captured) && captured <= cutoff;
}
export class ScreenshotRetentionService {
	constructor(private readonly repository = new ReportRepository()) {}
	async run(now = new Date()) {
		if (!Number.isFinite(now.getTime())) throw new Error('Invalid cleanup time');
		const cutoff = now.getTime() - retentionMs;
		let expired = 0;
		let reports = 0;
		for (const report of await this.repository.list()) {
			const count = await this.expireReport(report.id, cutoff, now);
			if (count) reports++;
			expired += count;
		}
		return { expired, reports };
	}
	private async expireReport(id: string, cutoff: number, now: Date) {
		const directory = this.repository.directory(id);
		const exportLock = join(directory, 'export-lock');
		await mkdir(exportLock, { recursive: true, mode: 0o700 });
		return reportLock(exportLock, () =>
			reportLock(directory, async () => {
				const report = await this.repository.get(id);
				const stale = report.evidence.filter((item) => expired(item, report, cutoff));
				if (!stale.length) return 0;
				for (const item of stale) r2ObjectKey(id, item.file);
				await this.purgeCopies(directory, report, stale);
				for (const item of stale) {
					item.missing = true;
					item.status = 'not-proven';
					item.note = `${item.note || ''} Screenshot expired after 30 days.`.trim();
				}
				if (report.state === 'finalized') report.status = resultStatus(report);
				report.updatedAt = now.toISOString();
				await atomicJson(join(directory, 'manifest.json'), report);
				if (report.state === 'finalized')
					await new ReportExportService(this.repository).rebuildAfterRetention(report, directory);
				return stale.length;
			})
		);
	}
	private async purgeCopies(directory: string, report: Report, stale: Evidence[]) {
		const assets = join(directory, 'assets');
		const info = await lstat(assets).catch(() => undefined);
		if (info?.isSymbolicLink()) throw new Error('Invalid report assets directory');
		const exportDirectory = join(directory, 'exports');
		const exportAssets = join(exportDirectory, 'assets');
		if (report.exports) {
			for (const path of [exportDirectory, exportAssets]) {
				if ((await lstat(path).catch(() => undefined))?.isSymbolicLink())
					throw new Error('Invalid report exports directory');
			}
		}
		for (const file of new Set(stale.map((item) => item.file))) {
			const retained = report.evidence.some(
				(item) => item.file === file && !item.missing && !stale.includes(item)
			);
			if (!retained) {
				await rm(join(assets, file), { force: true });
				if (report.exports) await rm(join(exportAssets, file), { force: true });
			}
		}
	}
}
