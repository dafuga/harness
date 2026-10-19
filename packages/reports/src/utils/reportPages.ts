import { reportRuntimeRoot } from './reportRuntimeRoot';
import { join } from 'node:path';
import { reportProcess } from './reportProcess';
import { r2ScreenshotConfig } from '../adapters/R2ScreenshotStoreAdapter';
import type { PublicationBundle } from './reportPublication';
export async function reportPages(bundle: PublicationBundle) {
	const root = reportRuntimeRoot();
	const project = process.env.PROJECT_REPORTS_PAGES_PROJECT || 'project-report-shares';
	if (!/^[a-z0-9-]{1,58}$/.test(project)) throw new Error('Invalid Project Reports Pages project');
	const config = r2ScreenshotConfig(process.env, process.env.PROJECT_REPORTS_CONFIG_FILE);
	if (!config.accountId) throw new Error('Project Reports Cloudflare account is required');
	const result = await reportProcess(
		process.execPath,
		[
			'x',
			'wrangler@4.93.0',
			'pages',
			'deploy',
			bundle.directory,
			'--project-name',
			project,
			'--branch',
			`report-${bundle.id}`,
			...(bundle.revision ? ['--commit-hash', bundle.revision] : [])
		],
		root,
		{
			...process.env,
			CLOUDFLARE_ACCOUNT_ID: config.accountId,
			XDG_CONFIG_HOME:
				process.env.PROJECT_REPORTS_CLOUDFLARE_CONFIG_HOME ?? join(root, '.env.cloudflare-auth')
		}
	);
	if (result.code !== 0)
		throw new Error(`Cloudflare Pages publication failed: ${result.output.slice(-1200)}`);
	const escaped = project.replace(/-/g, '\\-');
	const urls = result.output.match(
		new RegExp(`https://[a-z0-9-]+\\.${escaped}\\.pages\\.dev`, 'g')
	);
	if (!urls?.length) throw new Error('Cloudflare Pages did not return a deployment URL');
	return urls[0];
}
