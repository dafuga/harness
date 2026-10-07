import { readFile, lstat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { ReportRepository } from '../repositories/ReportRepository';
import { replayVideo, replayVideoKey } from '../utils/replayVideo';
import { reportRetention } from '../utils/reportRetention';
import { reportLock } from '../utils/reportLock';
import { ReplayStorageService } from './ReplayStorageService';
import type { Report } from '../models/Report.types';
const jobs = new Map<string, Promise<Buffer>>();
export class ReplayVideoService {
	constructor(private readonly repository = new ReportRepository()) {}
	async create(id: string) {
		const report = await this.repository.get(id);
		if (reportRetention(report)) throw new Error('Report expired after 30 days');
		const key = id + ':' + replayVideoKey(report);
		let job = jobs.get(key);
		if (!job) {
			if (jobs.size >= 2) throw new Error('Another video is being prepared. Try again shortly.');
			job = reportLock(this.repository.directory(id), () => this.generate(report));
			jobs.set(key, job);
		}
		try {
			return await job;
		} finally {
			jobs.delete(key);
		}
	}
	private async generate(report: Report) {
		const directory = this.repository.directory(report.id);
		const cache = join(directory, 'replays');
		const file = replayVideoKey(report) + '.mp4';
		const storage = new ReplayStorageService();
		if (!(await lstat(join(cache, file)).catch(() => undefined))) {
			const restored = await storage.restore(report, cache, file);
			if (restored) return restored;
		}
		const path = await replayVideo(report, directory);
		await storage.store(report, cache, basename(path));
		return readFile(path);
	}
}
