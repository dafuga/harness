import { expect, test, vi } from 'vitest';
import { CloudflareDeployAdapter } from '../../src/adapters/development-tooling/CloudflareDeployAdapter';
import type {
	CloudflareTarget,
	DeployCommand
} from '../../src/models/development-tooling/Deployment.types';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
const target: CloudflareTarget = {
	environment: 'stage',
	kind: 'pages',
	config: 'wrangler.jsonc',
	name: 'example',
	accountId: 'a'.repeat(32),
	tokenEnv: 'TEST_STAGE_CF_TOKEN',
	wranglerEnvironment: '',
	branch: 'staging',
	output: 'build',
	healthUrl: 'https://stage.example.invalid'
};
test('Cloudflare refuses a lower environment mapped to the live production branch', async () => {
	process.env.TEST_STAGE_CF_TOKEN = 'synthetic';
	const execute = vi.fn(async (_command: DeployCommand) => 'https://abcd.example.pages.dev');
	const request = vi.fn(
		async () =>
			new Response(JSON.stringify({ success: true, result: { production_branch: 'staging' } }))
	);
	try {
		const adapter = new CloudflareDeployAdapter({ execute, request });
		await expect(
			adapter.deploy(target, { root: '/tmp/project', commit: 'a'.repeat(40) })
		).rejects.toThrow(/production branch/);
		expect(execute).not.toHaveBeenCalled();
	} finally {
		delete process.env.TEST_STAGE_CF_TOKEN;
	}
});
test('Cloudflare uses the exact account, token, branch and source commit', async () => {
	process.env.TEST_STAGE_CF_TOKEN = 'synthetic';
	const execute = vi.fn(async (_command: DeployCommand) => 'https://abcd1234.example.pages.dev');
	const request = vi.fn(
		async () =>
			new Response(JSON.stringify({ success: true, result: { production_branch: 'main' } }))
	);
	try {
		const adapter = new CloudflareDeployAdapter({ execute, request });
		expect(
			await adapter.deploy(target, { root: '/tmp/project', commit: 'b'.repeat(40) })
		).toMatchObject({ deploymentId: 'abcd1234', url: 'https://abcd1234.example.pages.dev' });
		expect(execute.mock.calls[0][0].args).toEqual([
			'bun',
			'x',
			'--no-install',
			'wrangler',
			'pages',
			'deploy',
			'build',
			'--project-name',
			'example',
			'--branch',
			'staging',
			'--commit-hash',
			'b'.repeat(40),
			'--commit-dirty=false',
			'--config',
			'wrangler.jsonc'
		]);
		expect(execute.mock.calls[0][0].env).toMatchObject({
			CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
			CLOUDFLARE_API_TOKEN: 'synthetic'
		});
	} finally {
		delete process.env.TEST_STAGE_CF_TOKEN;
	}
});
function sources(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return sources(path);
		return /\.(ts|js|svelte)$/.test(path) ? [path] : [];
	});
}
test('the Deployment and DesignVersion relocation stubs stay removed and nothing imports their old paths', () => {
	const desktop = resolve(import.meta.dirname, '../..');
	const stubs = [
		resolve(desktop, 'src/models/Deployment.types'),
		resolve(desktop, 'src/models/DesignVersion.types')
	];
	const roots = [
		resolve(desktop, 'src'),
		resolve(desktop, 'test'),
		resolve(desktop, '../reports/tests')
	];
	const imports = roots.flatMap((root) =>
		sources(root).flatMap((path) =>
			[
				...readFileSync(path, 'utf8').matchAll(
					/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*|\bvi\.mock\(\s*)['"]([^'"]+)['"]/g
				)
			]
				.filter(([, specifier]) => stubs.includes(resolve(dirname(path), specifier)))
				.map(([, specifier]) => `${relative(desktop, path)} -> ${specifier}`)
		)
	);
	expect(imports, 'removed model stubs must not be imported').toEqual([]);
	expect(
		stubs.filter((stub) => existsSync(`${stub}.ts`)),
		'removed model stubs must stay deleted'
	).toEqual([]);
});
