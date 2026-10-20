import { expect, test } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deploymentConfig, deploymentPath } from '../../src/utils/deploymentConfig';
test.each(['jsonc', 'toml'])(
	'Cloudflare %s discovery keeps explicit environment mapping and configuration fingerprint',
	async (extension) => {
		const root = await mkdtemp(join(tmpdir(), 'harness-cf-config-'));
		try {
			const config = 'wrangler.' + extension;
			await writeFile(
				join(root, config),
				extension === 'toml'
					? 'name = "fixture"\n[env.development]\nname = "fixture-dev"\n'
					: '{"name":"fixture",/* comment */"env":{"development":{"name":"fixture-dev"}}}'
			);
			const mapping = {
				adapter: 'cloudflare',
				sourceBranch: 'dev',
				config,
				environments: {
					dev: {
						wranglerEnvironment: 'development',
						name: 'fixture-dev',
						accountId: 'a'.repeat(32),
						tokenEnv: 'HARNESS_FIXTURE_DEV_CLOUDFLARE_API_TOKEN',
						healthUrl: 'https://dev.example.invalid'
					}
				}
			};
			await writeFile(join(root, 'harness.deploy.json'), JSON.stringify(mapping));
			const result = await deploymentConfig(root);
			expect(result.targets.dev).toMatchObject({
				environment: 'dev',
				name: 'fixture-dev',
				wranglerEnvironment: 'development',
				kind: 'workers'
			});
			expect(result.targets.prod).toBeUndefined();
			expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
			expect(() => deploymentPath(root, '../outside')).toThrow(/inside/);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}
);

test.each(['bundled', 'external'])(
	'the %s Node deployment bundle resolves JSONC parsing without package-relative runtime requires',
	async (mode) => {
		const { execFileSync } = await import('node:child_process');
		const root = await mkdtemp(join(tmpdir(), 'harness-cf-bundle-'));
		try {
			await writeFile(join(root, 'wrangler.jsonc'), '{"name":"fixture",/* comment */"env":{}}');
			await writeFile(
				join(root, 'harness.deploy.json'),
				JSON.stringify({ adapter: 'cloudflare', sourceBranch: 'dev', environments: {} })
			);
			const bundle = join(root, 'deployment.cjs');
			execFileSync(
				'bun',
				[
					'build',
					'src/utils/deploymentConfig.ts',
					'--target',
					'node',
					'--format',
					'cjs',
					...(mode === 'external' ? ['--external=jsonc-parser'] : []),
					'--outfile',
					bundle
				],
				{ cwd: process.cwd(), stdio: 'pipe' }
			);
			const output = execFileSync(
				process.execPath,
				[
					'-e',
					'require(process.argv[1]).deploymentConfig(process.argv[2]).then(value => process.stdout.write(value.sourceBranch))',
					bundle,
					root
				],
				{
					encoding: 'utf8',
					stdio: 'pipe',
					env: { ...process.env, NODE_PATH: join(process.cwd(), '../..', 'node_modules') }
				}
			);
			expect(output).toBe('dev');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}
);
