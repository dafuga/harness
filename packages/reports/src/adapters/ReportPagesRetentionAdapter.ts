import { reportRuntimeRoot } from '../utils/reportRuntimeRoot';
import { join } from 'node:path';
import { r2ScreenshotConfig } from './R2ScreenshotStoreAdapter';
import { reportProcess } from '../utils/reportProcess';
import { safeId } from '../utils/reportFiles';
interface Deployment {
	Id: string;
	Environment: string;
	Branch: string;
	Deployment: string;
}
function publicationProject(url?: string) {
	const configured = process.env.PROJECT_REPORTS_PAGES_PROJECT || 'project-report-shares';
	if (!url) return configured;
	const match = url.match(/^https:\/\/[a-z0-9-]+\.([a-z0-9-]+)\.pages\.dev\/?$/);
	if (!match) throw new Error('Invalid report publication receipt');
	if (match[1] !== configured)
		throw new Error('Publication escaped the Project Reports Pages project');
	return configured;
}
export class ReportPagesRetentionAdapter {
	constructor(
		private readonly command = reportProcess,
		private readonly request: (
			input: string | URL | Request,
			init?: RequestInit
		) => Promise<Response> = fetch
	) {}
	async purge(receipt: { run: string; url?: string }, dryRun = false) {
		const project = publicationProject(receipt.url);
		const output = await this.execute([
			'list',
			'--project-name',
			project,
			'--environment',
			'preview',
			'--json'
		]);
		const deployments = JSON.parse(output) as Deployment[];
		const matching = deployments.filter(
			(item) => item.Branch === 'report-' + safeId(receipt.run) && item.Environment === 'Preview'
		);
		await this.checkListed(receipt.url, matching);
		for (const item of matching) {
			if (!/^[a-f0-9-]{36}$/.test(item.Id)) throw new Error('Invalid report deployment ID');
			if (!dryRun) await this.execute(['delete', item.Id, '--project-name', project, '--force']);
		}
		return matching.length;
	}
	private async checkListed(url: string | undefined, matching: Deployment[]) {
		if (!url || matching.some((item) => item.Deployment === url)) return;
		const response = await this.request(url, { signal: AbortSignal.timeout(30000) });
		if (response.status !== 404)
			throw new Error('Published report absent from deployment listing; local receipt retained');
	}
	private async execute(args: string[]) {
		const root = reportRuntimeRoot();
		const config = r2ScreenshotConfig(process.env, process.env.PROJECT_REPORTS_CONFIG_FILE);
		if (!config.accountId)
			throw new Error('Project Reports Cloudflare account is required for published cleanup');
		const result = await this.command(
			process.execPath,
			['x', 'wrangler@4.93.0', 'pages', 'deployment', ...args],
			root,
			{
				...process.env,
				CLOUDFLARE_ACCOUNT_ID: config.accountId,
				XDG_CONFIG_HOME:
					process.env.PROJECT_REPORTS_CLOUDFLARE_CONFIG_HOME ?? join(root, '.env.cloudflare-auth')
			}
		);
		if (result.code !== 0)
			throw new Error(
				'Cloudflare Pages cleanup failed; local publication receipt retained for retry'
			);
		return result.output;
	}
}
