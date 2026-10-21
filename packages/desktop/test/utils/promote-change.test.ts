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
}, 60000);

const scopedChanges = (['dev', 'stage', 'preprod', 'prod'] as const).flatMap((environment) => [
	{ environment, task: false },
	{ environment, task: true }
]);
test.each(scopedChanges)(
	'a successful change scoped to $environment (project chat: $task) verifies, commits and promotes only through its lower boundary',
	async ({ environment, task }) => {
		const { vi } = await import('vitest');
		const { writeFile } = await import('node:fs/promises');
		const { join } = await import('node:path');
		const { git } = await import('../run-fixture');
		const commands = await import('../../src/utils/deploymentCommand');
		const { DeploymentService } = await import('../../src/services/DeploymentService');
		const f = await fixture(async (turn) => {
			await writeFile(join(turn.cwd, 'src/owned.ts'), 'verified change');
		});
		await configure(f.root);
		const request = await approve(f);
		const execute = vi.spyOn(commands, 'deploymentCommand').mockResolvedValue('verified');
		const automatic = vi.spyOn(DeploymentService.prototype, 'enqueue').mockResolvedValue([]);
		try {
			await f.service.start(
				task
					? {
							intent: 'task',
							category: 'functions',
							mode: 'change',
							projectId: f.session.projectId!,
							branch: 'main',
							commit: git(f.root, 'rev-parse', 'HEAD'),
							provider: request.provider,
							model: request.model,
							effort: request.effort,
							text: request.text,
							environment
						}
					: { ...request, environment }
			);
			await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
			expect(execute).toHaveBeenCalledWith({ args: ['bun', 'run', 'check'], cwd: f.root });
			expect(automatic).toHaveBeenCalledWith({
				environment,
				commit: git(f.root, 'rev-parse', 'HEAD')
			});
			expect(git(f.root, 'status', '--porcelain')).toBe('');
			expect(f.events).toContainEqual(
				expect.objectContaining({ kind: 'finished', verified: false })
			);
		} finally {
			execute.mockRestore();
			automatic.mockRestore();
		}
	},
	60000
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
