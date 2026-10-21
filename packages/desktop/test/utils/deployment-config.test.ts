import { expect, test } from 'vitest';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { deploymentConfig, deploymentPath } from '../../src/utils/deploymentConfig';
import { PerformanceProfileService } from '../../../../src/services/PerformanceProfileService';
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
			if (process.env.HARNESS_EVIDENCE_DIR) {
				await new PerformanceProfileService().capture(
					{
						unit: 'desktop.function.deployment-config',
						workload: `cloudflare-config-${extension}`,
						iterations: 10
					},
					() => deploymentConfig(root)
				);
			}
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}
);

test.each(['cjs', 'esm'] as const)(
	'the Node %s deployment boundary resolves JSONC parsing',
	async (format) => {
		const { execFileSync } = await import('node:child_process');
		const root = await mkdtemp(join(tmpdir(), 'harness-cf-bundle-'));
		try {
			await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir');
			await writeFile(join(root, 'wrangler.jsonc'), '{"name":"fixture",/* comment */"env":{}}');
			await writeFile(
				join(root, 'harness.deploy.json'),
				JSON.stringify({ adapter: 'cloudflare', sourceBranch: 'dev', environments: {} })
			);
			const bundle = join(root, `deployment.${format === 'cjs' ? 'cjs' : 'mjs'}`);
			execFileSync(
				'bun',
				[
					'build',
					'src/utils/deploymentConfig.ts',
					'--target',
					'node',
					'--format',
					format,
					...(format === 'esm' ? ['--packages', 'external'] : []),
					'--outfile',
					bundle
				],
				{ cwd: process.cwd(), stdio: 'pipe' }
			);
			const output = execFileSync(
				process.execPath,
				[
					'--input-type=module',
					'-e',
					'import {pathToFileURL} from "node:url"; const loaded = await import(pathToFileURL(process.argv[1]).href); const config = loaded.deploymentConfig ?? loaded.default.deploymentConfig; process.stdout.write((await config(process.argv[2])).sourceBranch);',
					bundle,
					root
				],
				{ encoding: 'utf8', stdio: 'pipe' }
			);
			expect(output).toBe('dev');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}
);
