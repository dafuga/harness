import type { Options } from './CloudflareDeployAdapter.types';
import { deploymentConfig } from '../../utils/development-tooling/deploymentConfig';
import { deploymentCommand } from '../../utils/development-tooling/deploymentCommand';
import type {
	CloudflareTarget,
	DeploymentPlugin
} from '../../models/development-tooling/Deployment.types';
export class CloudflareDeployAdapter implements DeploymentPlugin {
	readonly id = 'cloudflare';
	constructor(private options: Options = {}) {}
	discover(root: string) {
		return deploymentConfig(root);
	}
	async deploy(target: CloudflareTarget, source: { root: string; commit: string }) {
		const token = process.env[target.tokenEnv];
		if (!token) throw new Error(`Configure the dedicated credential ${target.tokenEnv}.`);
		await this.checkTarget(target, token);
		const args = ['bun', 'x', '--no-install', 'wrangler'];
		if (target.kind === 'pages')
			args.push(
				'pages',
				'deploy',
				target.output,
				'--project-name',
				target.name,
				'--branch',
				target.branch,
				'--commit-hash',
				source.commit,
				'--commit-dirty=false'
			);
		else args.push('deploy', '--env', target.wranglerEnvironment);
		args.push('--config', target.config);
		const output = await (this.options.execute ?? deploymentCommand)({
			args,
			cwd: source.root,
			env: {
				CLOUDFLARE_ACCOUNT_ID: target.accountId,
				CLOUDFLARE_API_TOKEN: token,
				WRANGLER_SEND_METRICS: 'false',
				CLOUDFLARE_ENV: target.wranglerEnvironment
			}
		});
		return deploymentIdentity(target, output);
	}
	private async checkTarget(target: CloudflareTarget, token: string) {
		const resource =
			target.kind === 'pages' ? `pages/projects/${target.name}` : `workers/scripts/${target.name}`;
		const response = await (this.options.request ?? fetch)(
			`https://api.cloudflare.com/client/v4/accounts/${target.accountId}/${resource}`,
			{
				headers: { Authorization: `Bearer ${token}` },
				signal: AbortSignal.timeout(15000)
			}
		);
		if (!response.ok) throw new Error('Cloudflare target/account access could not be verified.');
		if (target.kind !== 'pages') return;
		const value = (await response.json()) as {
			success: boolean;
			result?: { production_branch?: string };
		};
		const production = value.result?.production_branch;
		if (!value.success || !production) throw new Error('Cloudflare production branch is unknown.');
		if ((target.environment === 'prod') !== (target.branch === production))
			throw new Error('The Pages target conflicts with the live production branch.');
	}
}

function deploymentIdentity(target: CloudflareTarget, output: string) {
	const url = output.match(/https:\/\/[a-z0-9.-]+\.(?:pages|workers)\.dev\b/i)?.[0];
	const deploymentId =
		target.kind === 'pages'
			? url?.match(/https:\/\/([a-z0-9]+)\./)?.[1]
			: output.match(/Version ID:\s*([a-f0-9-]{36})/i)?.[1];
	if (!deploymentId)
		throw new Error(
			'Cloudflare did not return a deployment identity. Inspect the provider before retrying.'
		);
	return { deploymentId, url: url ?? target.healthUrl };
}
