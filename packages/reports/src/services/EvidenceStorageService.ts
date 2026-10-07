import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Report } from '../models/Report.types';
import { R2EvidenceStoreAdapter } from '../adapters/R2EvidenceStoreAdapter';
import { registeredAsset } from '../utils/reportAssets';
import { mediaMime } from '../utils/evidenceMedia';
import { reportRetention } from '../utils/reportRetention';

export class EvidenceStorageService {
	async store(report: Report, directory: string) {
		const pending = report.evidence.filter((item) => !item.storage && !item.missing);
		if (!pending.length) return;
		if (reportRetention(report))
			throw new Error('Report expired after 30 days; create a new report');
		const storage = R2EvidenceStoreAdapter.fromEnvironment();
		if (!storage) return;
		const uploaded = new Set<string>();
		for (const item of pending) {
			if (!uploaded.has(item.file)) {
				const path = await registeredAsset(
					join(directory, 'assets'),
					item.file,
					pending.map((value) => value.file)
				);
				await storage.put(report.id, item.file, await readFile(path), mediaMime(item.file));
				uploaded.add(item.file);
			}
			item.storage = 'r2-evidence';
		}
	}
}
