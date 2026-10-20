import { expect, test } from 'vitest';
import { prepareChangeEnvironment } from '../../src/utils/promoteChange';
import { fixture, approve } from '../run-fixture';
test('legacy changes remain local, environment changes reject missing deployment mapping before an agent starts', async () => {
	const f = await fixture();
	const request = await approve(f);
	await expect(prepareChangeEnvironment(f.session, request)).resolves.toBeUndefined();
	await expect(f.service.start({ ...request, environment: 'prod' })).rejects.toThrow(/Wrangler/);
	expect(f.run).not.toHaveBeenCalled();
	expect(f.session.busy).toBe(false);
}, 15000);

test.each(['dev', 'stage', 'preprod', 'prod'] as const)(
	'a successful change scoped to %s verifies, commits and promotes only through its lower boundary',
	async (environment) => {
		const { vi } = await import('vitest');
		const { writeFile } = await import('node:fs/promises');
		const { join } = await import('node:path');
		const { git, settled } = await import('../run-fixture');
		const commands = await import('../../src/utils/deploymentCommand');
		const { DeploymentService } = await import('../../src/services/DeploymentService');
		const f = await fixture(async (turn) => {
			await writeFile(join(turn.cwd, 'src/owned.ts'), 'verified change');
		});
		await configure(f.root);
		const request = await approve(f);
		const execute = vi.spyOn(commands, 'deploymentCommand').mockResolvedValue('verified');
		const automatic = vi.spyOn(DeploymentService.prototype, 'automatic').mockResolvedValue({
			environment: 'stage',
			commit: 'a',
			branch: 'main',
			adapter: 'cloudflare',
			updatedAt: '2026-10-20T12:00:00.000Z',
			deploymentId: 'synthetic',
			configuration: 'synthetic-config',
			url: 'https://example.invalid'
		});
		try {
			await settled(f, { ...request, environment });
			expect(execute).toHaveBeenCalledWith({ args: ['bun', 'run', 'check'], cwd: f.root });
			expect(automatic.mock.calls.map(([input]) => input.environment)).toEqual(
				{
					dev: ['dev'],
					stage: ['dev', 'stage'],
					preprod: ['dev', 'stage', 'preprod'],
					prod: ['dev', 'stage', 'preprod']
				}[environment]
			);
			expect(
				automatic.mock.calls.every(([input]) => input.commit === git(f.root, 'rev-parse', 'HEAD'))
			).toBe(true);
			expect(git(f.root, 'status', '--porcelain')).toBe('');
			expect(f.events).toContainEqual(
				expect.objectContaining({ kind: 'finished', verified: false })
			);
		} finally {
			execute.mockRestore();
			automatic.mockRestore();
		}
	},
	15000
);

async function configure(root: string) {
	const { writeFile } = await import('node:fs/promises');
	const { join } = await import('node:path');
	const { git } = await import('../run-fixture');

	const wrangler = {
		name: 'fixture',
		env: Object.fromEntries(
			['dev', 'stage', 'preprod'].map((name) => [name, { name: 'fixture-' + name }])
		)
	};
	await writeFile(join(root, 'wrangler.jsonc'), JSON.stringify(wrangler));
	await writeFile(
		join(root, 'harness.deploy.json'),
		JSON.stringify({
			adapter: 'cloudflare',
			config: 'wrangler.jsonc',
			sourceBranch: 'main',
			environments: Object.fromEntries(
				['dev', 'stage', 'preprod'].map((name) => [
					name,
					{
						name: 'fixture-' + name,
						wranglerEnvironment: name,
						accountId: 'a'.repeat(32),
						tokenEnv: `HARNESS_FIXTURE_${name.toUpperCase()}_CLOUDFLARE_API_TOKEN`,
						healthUrl: 'https://example.invalid'
					}
				])
			)
		})
	);
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'chore: configure fixture');
}
