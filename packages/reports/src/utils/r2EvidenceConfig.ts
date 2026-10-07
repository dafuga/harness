import { resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { r2ScreenshotConfig } from '../adapters/R2ScreenshotStoreAdapter';
function isolatedTestStore() {
	const root = resolve(process.env.PROJECT_REPORTS_HOME || '/');
	return [tmpdir(), '/tmp', '/private/tmp'].some((base) => root.startsWith(resolve(base) + sep));
}
export function r2EvidenceConfig() {
	if (process.env.PROJECT_REPORTS_ASSET_STORAGE === 'local') {
		if (!isolatedTestStore())
			throw new Error(
				'Local-only storage is restricted to temporary test stores; real report media requires Cloudflare R2'
			);
		return undefined;
	}
	const config = r2ScreenshotConfig(
		process.env,
		process.env.NODE_ENV === 'test' ? undefined : process.env.PROJECT_REPORTS_CONFIG_FILE
	);
	const values = [config.accountId, config.bucket, config.accessKeyId, config.secretAccessKey];
	if (values.every((value) => !value) && isolatedTestStore()) return undefined;
	if (values.some((value) => !value))
		throw new Error(
			'Cloudflare R2 evidence storage is partially configured; real reports require all four R2 settings'
		);
	if (config.endpoint && !/^http:\/\/127\.0\.0\.1:\d+$/.test(config.endpoint))
		throw new Error('R2 endpoint override must be a local test server');
	return config;
}
