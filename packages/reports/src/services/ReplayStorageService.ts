import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Report } from '../models/Report.types';
import { R2EvidenceStoreAdapter, replayObjectKey } from '../adapters/R2EvidenceStoreAdapter';
import { registeredAsset } from '../utils/reportAssets';
import { atomicJson, readJson } from '../utils/reportFiles';
import { reportRetention } from '../utils/reportRetention';
type Receipts = Record<string, string>;
async function receipts(directory: string): Promise<Receipts> {
	if ((await lstat(directory)).isSymbolicLink()) throw new Error('Invalid replay directory');
	return readJson<Receipts>(join(directory, 'storage.json')).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code !== 'ENOENT') throw error;
			return {} as Receipts;
		}
	);
}
export class ReplayStorageService {
	async store(report: Report, directory: string, file: string) {
		replayObjectKey(report.id, file);
		if (reportRetention(report)) throw new Error('Report expired after 30 days');
		const storage = R2EvidenceStoreAdapter.fromEnvironment();
		if (!storage) return false;
		const recorded = await receipts(directory);
		if (recorded[file]) return false;
		const bytes = await readFile(await registeredAsset(directory, file, [file]));
		await storage.putReplay(report.id, file, bytes);
		recorded[file] = createHash('sha256').update(bytes).digest('hex');
		await atomicJson(join(directory, 'storage.json'), recorded);
		return true;
	}
	async restore(report: Report, directory: string, file: string) {
		replayObjectKey(report.id, file);
		if (reportRetention(report)) throw new Error('Report expired after 30 days');
		const recorded = await receipts(directory).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== 'ENOENT') throw error;
			return {} as Receipts;
		});
		if (!recorded[file]) return undefined;
		const storage = R2EvidenceStoreAdapter.fromEnvironment();
		if (!storage) return undefined;
		const bytes = await storage.getReplay(report.id, file);
		if (createHash('sha256').update(bytes).digest('hex') !== recorded[file])
			throw new Error('Cloud replay digest differs');
		const destination = join(directory, file);
		if ((await lstat(destination).catch(() => undefined))?.isSymbolicLink())
			throw new Error('Invalid replay artifact');
		await writeFile(destination, bytes, { mode: 0o600 });
		return bytes;
	}
}
