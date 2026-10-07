import { reportBuildIdentity } from './reportBuildIdentity';
import { json, error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ReportRepository } from '../repositories/ReportRepository';
import { registeredAsset } from './reportAssets';
import { R2ScreenshotStoreAdapter } from '../adapters/R2ScreenshotStoreAdapter';
import { R2EvidenceStoreAdapter } from '../adapters/R2EvidenceStoreAdapter';
import type { Report } from '../models/Report.types';
import { mediaMime } from './evidenceMedia';
import { mediaResponse } from './mediaResponse';
export const repository = new ReportRepository();
export function reportHttp() {
	return json({
		app: 'project-reports',
		version: 1,
		buildId: reportBuildIdentity(),
		root: createHash('sha256').update(repository.root).digest('hex')
	});
}
function assetIsRemote(run: Report, file: string) {
	const matches = run.evidence.filter((item) => item.file === file);
	const available = matches.filter((item) => !item.missing);
	if (!available.length) error(matches.length ? 410 : 404, 'Evidence expired or unavailable');
	return available.find((item) => item.storage)?.storage;
}
export async function reportFile(id: string, type: string, file: string, range?: string | null) {
	const run = await repository.get(id);
	const assets = type === 'assets';
	if (!['assets', 'exports'].includes(type)) error(404, 'Not found');
	const registered = assets ? [file] : Object.values(run.exports ?? {});
	if (!registered.includes(file)) error(404, 'Not found');
	const remote = assets && assetIsRemote(run, file);
	const bytes = remote
		? await remoteAsset(id, file, remote)
		: await readFile(await registeredAsset(join(repository.directory(id), type), file, registered));
	return mediaResponse(
		bytes,
		mediaMime(file),
		range,
		assets ? 'inline' : `attachment; filename="${file}"`
	);
}
async function remoteAsset(id: string, file: string, storage: 'r2' | 'r2-evidence') {
	if (storage === 'r2') return R2ScreenshotStoreAdapter.fromEnvironment().get(id, file);
	const adapter = R2EvidenceStoreAdapter.fromEnvironment();
	if (!adapter) throw new Error('Cloudflare R2 evidence storage is not configured');
	return adapter.get(id, file);
}
