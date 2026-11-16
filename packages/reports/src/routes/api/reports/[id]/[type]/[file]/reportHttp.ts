// @harness-uid u_etqaoze6h6
import { repository } from '../../../../../../utils/reports-media/reportHttp';
import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { registeredAsset } from '../../../../../../utils/reports-media/reportAssets';
import { R2ScreenshotStoreAdapter } from '../../../../../../adapters/reports-media/R2ScreenshotStoreAdapter';
import { R2EvidenceStoreAdapter } from '../../../../../../adapters/R2EvidenceStoreAdapter';
import type { Report } from '../../../../../../models/reports-media/Report.types';
import { mediaMime } from '../../../../../../utils/verification-evidence/evidenceMedia';
import { mediaResponse } from '../../../../../../utils/development-tooling/mediaResponse';
import { R2EvidenceStorageNotConfiguredError } from './reportHttp.types';

function assetIsRemote(run: Report, file: string) {
	const matches = run.evidence.filter((item) => item.file === file);
	const available = matches.filter((item) => !item.missing);
	if (!available.length) error(matches.length ? 410 : 404, 'Evidence expired or unavailable');
	return available.find((item) => item.storage)?.storage;
}

export async function reportFile(id: string, type: string, file: string, range?: string | null) {
	const run = await repository.get(id);
	if (type !== 'assets') error(404, 'Not found');
	const remote = assetIsRemote(run, file);
	const bytes = remote
		? await remoteAsset(id, file, remote)
		: await readFile(await registeredAsset(join(repository.directory(id), type), file, [file]));
	return mediaResponse(bytes, mediaMime(file), range, 'inline');
}

async function remoteAsset(id: string, file: string, storage: 'r2' | 'r2-evidence') {
	if (storage === 'r2') return R2ScreenshotStoreAdapter.fromEnvironment().get(id, file);
	const adapter = R2EvidenceStoreAdapter.fromEnvironment();
	if (!adapter)
		throw new R2EvidenceStorageNotConfiguredError(
			'Cloudflare R2 evidence storage is not configured'
		);
	return adapter.get(id, file);
}
