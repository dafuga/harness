import { lstat, mkdir, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportRepository } from '../repositories/ReportRepository';
import { R2ReportRetentionAdapter } from '../adapters/R2ReportRetentionAdapter';
import { ReportPagesRetentionAdapter } from '../adapters/ReportPagesRetentionAdapter';
import { readJson } from '../utils/reportFiles';
import { reportLock } from '../utils/reportLock';
import { reportRetention, reportLifetimeMs } from '../utils/reportRetention';
import { reportLocalCleanup } from '../utils/reportLocalCleanup';
import type { StorageSyncOptions } from './ReportStorageSyncService';
import type { Report } from '../models/Report.types';
import { reportCleanupLog } from '../utils/reportCleanupLog';
function retentionResult(dryRun: boolean) {
	return {
		plannedReports: [] as string[],
		deletedReports: [] as string[],
		cloudObjects: 0,
		pages: 0,
		localFiles: 0,
		errors: [] as string[],
		dryRun
	};
}
function failureMessage(id: string, error: unknown) {
	return `${id}: ${error instanceof Error ? error.message : 'Report cleanup failed'}`;
}
async function checkRoot(root: string) {
	for (const path of [
		root,
		join(root, 'runs'),
		join(root, 'publications'),
		join(root, 'retention-lock')
	]) {
		if ((await lstat(path).catch(() => undefined))?.isSymbolicLink())
			throw new Error('Invalid report cleanup root');
	}
}
async function publication(root: string, id: string) {
	return readJson<{ run: string; url?: string; publishedAt: string }>(
		join(root, 'publications', id + '.json')
	).catch((error: NodeJS.ErrnoException) => {
		if (error.code !== 'ENOENT') throw error;
		return undefined;
	});
}
async function removeStaging(root: string, id: string) {
	const directory = join(root, 'publication-staging');
	if ((await lstat(directory).catch(() => undefined))?.isSymbolicLink())
		throw new Error('Invalid publication staging directory');
	for (const name of await readdir(directory).catch(() => [])) {
		if (name.startsWith(id + '-'))
			await rm(join(directory, name), { recursive: true, force: true });
	}
}
async function orphanPublications(
	repository: ReportRepository,
	known: Set<string>,
	cutoff: number,
	dryRun: boolean
) {
	const directory = join(repository.root, 'publications');
	let deleted = 0;
	for (const file of await readdir(directory).catch(() => [])) {
		if (!/^[a-zA-Z0-9_-]{1,100}\.json$/.test(file) || known.has(file.slice(0, -5))) continue;
		const receipt = await publication(repository.root, file.slice(0, -5));
		if (!receipt || receipt.run !== file.slice(0, -5))
			throw new Error('Invalid orphan publication receipt');
		const created = Date.parse(receipt.publishedAt);
		if (!Number.isFinite(created)) throw new Error('Invalid publication retention timestamp');
		if (created > cutoff) continue;
		deleted += await new ReportPagesRetentionAdapter().purge(receipt, dryRun);
		if (!dryRun) await rm(join(directory, file));
	}
	return deleted;
}
async function cleanupOrphans(
	repository: ReportRepository,
	reports: Report[],
	result: ReturnType<typeof retentionResult>,
	storage: R2ReportRetentionAdapter | undefined
) {
	try {
		const cutoff = Date.now() - reportLifetimeMs;
		const known = new Set(reports.map((report) => report.id));
		result.pages += await orphanPublications(repository, known, cutoff, result.dryRun);
		result.cloudObjects += (await storage?.orphans(known, cutoff, result.dryRun)) || 0;
		result.localFiles = await reportLocalCleanup(repository.root, cutoff, result.dryRun, known);
	} catch (error) {
		result.errors.push(error instanceof Error ? error.message : 'Orphan cleanup failed');
	}
	if (!result.dryRun) await reportCleanupLog(repository.root, result);
}
export class ReportRetentionService {
	constructor(private readonly repository = new ReportRepository()) {}
	async run(options: StorageSyncOptions = {}) {
		await checkRoot(this.repository.root);
		const result = retentionResult(Boolean(options.dryRun));
		const reports = options.run
			? [await this.repository.get(options.run)]
			: await this.repository.list();
		const storage = R2ReportRetentionAdapter.fromEnvironment();
		for (const report of reports) {
			try {
				if (!reportRetention(report)) continue;
				result.plannedReports.push(report.id);
				const counts = await this.expire(report.id, storage, result.dryRun);
				result.cloudObjects += counts.cloudObjects;
				result.pages += counts.pages;
				if (!result.dryRun) result.deletedReports.push(report.id);
			} catch (error) {
				result.errors.push(failureMessage(report.id, error));
			}
		}
		if (!options.run) await cleanupOrphans(this.repository, reports, result, storage);
		return result;
	}
	private async expire(id: string, storage: R2ReportRetentionAdapter | undefined, dryRun: boolean) {
		const directory = this.repository.directory(id);
		if (dryRun) return this.removeCopies(id, storage, true);
		const lock = join(directory, 'export-lock');
		if ((await lstat(lock).catch(() => undefined))?.isSymbolicLink())
			throw new Error('Invalid export lock');
		await mkdir(lock, { recursive: true, mode: 0o700 });
		return reportLock(lock, () =>
			reportLock(directory, async () => {
				if (!reportRetention(await this.repository.get(id))) return { cloudObjects: 0, pages: 0 };
				const counts = await this.removeCopies(id, storage, false);
				await removeStaging(this.repository.root, id);
				await rm(directory, { recursive: true, force: true });
				await rm(join(this.repository.root, 'publications', id + '.json'), { force: true });
				return counts;
			})
		);
	}
	private async removeCopies(
		id: string,
		storage: R2ReportRetentionAdapter | undefined,
		dryRun: boolean
	) {
		const receipt = await publication(this.repository.root, id);
		if (receipt && receipt.run !== id) throw new Error('Publication receipt does not match report');
		const pages = receipt ? await new ReportPagesRetentionAdapter().purge(receipt, dryRun) : 0;
		const cloudObjects = (await storage?.purge(id, dryRun)) || 0;
		return { cloudObjects, pages };
	}
}
