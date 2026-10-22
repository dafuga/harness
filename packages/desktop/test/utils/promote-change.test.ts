import { afterEach, expect, test, vi } from 'vitest';
import { TaskCompletionService } from '../../../../src/services/TaskCompletionService';
import { prepareChangeEnvironment } from '../../src/utils/promoteChange';
import { fixture, approve, git } from '../run-fixture';
afterEach(() => vi.restoreAllMocks());
test('legacy changes remain local, environment changes reject missing deployment mapping before an agent starts', async () => {
	const f = await fixture();
	const request = await approve(f);
	await expect(prepareChangeEnvironment(f.session, request)).resolves.toBeUndefined();
	await expect(f.service.start({ ...request, environment: 'prod' })).rejects.toThrow(/Wrangler/);
	expect(f.run).not.toHaveBeenCalled();
	expect(f.session.busy).toBe(false);
}, 15000);

const scopedChanges = (['dev', 'stage', 'preprod', 'prod'] as const).flatMap((environment) => [
	{ environment, task: false },
	{ environment, task: true }
]);
test.each(scopedChanges)(
	'a change with a passing completion audit scoped to $environment (project chat: $task) verifies and promotes only through its lower boundary',
	async ({ environment, task }) => {
		const { vi } = await import('vitest');
		const { writeFile } = await import('node:fs/promises');
		const { join } = await import('node:path');
		const { git } = await import('../run-fixture');
		// Spy on the declaration imported by the subject; its legacy entry only forwards it.
		const commands = await import('../../src/utils/development-tooling/deploymentCommand');
		const { DeploymentService } = await import('../../src/services/DeploymentService');
		const f = await fixture(async (turn) => {
			await writeFile(join(turn.cwd, 'src/owned.ts'), 'verified change');
			git(turn.cwd, 'add', 'src/owned.ts');
			git(turn.cwd, 'commit', '-m', 'feat: fixture agent commits its change');
		});
		await configure(f.root);
		const request = await approve(f);
		// This test isolates promotion coordination; the negative case below uses the real audit.
		const audited = vi
			.spyOn(TaskCompletionService.prototype, 'require')
			.mockImplementation(async (input) => ({
				schemaVersion: 1,
				id: 'mock-promotion-boundary',
				commit: git(f.root, 'rev-parse', 'HEAD'),
				kind: input.kind,
				goal: input.goal,
				task: { plan: null, loop: null, units: input.units ?? [] },
				passed: true,
				checks: [],
				limitation: 'Mocked audit boundary; not runtime verification evidence.'
			}));
		const execute = vi.spyOn(commands, 'deploymentCommand').mockResolvedValue('verified');
		const automatic = vi.spyOn(DeploymentService.prototype, 'enqueue').mockResolvedValue([]);
		try {
			await f.service.start(scopedRequest(f, request, { environment, task }));
			await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
			expect(audited).toHaveBeenCalledWith(
				expect.objectContaining({ kind: 'coding', goal: request.text })
			);
			expect(execute).toHaveBeenCalledWith({ args: ['bun', 'run', 'check'], cwd: f.root });
			expect(audited.mock.invocationCallOrder[0]).toBeLessThan(execute.mock.invocationCallOrder[0]);
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
	15000
);

test.each(scopedChanges)(
	'an unverified change scoped to $environment (project chat: $task) cannot verify or promote',
	async (scope) => {
		const { writeFile } = await import('node:fs/promises');
		const { join } = await import('node:path');
		const commands = await import('../../src/utils/deploymentCommand');
		const { DeploymentService } = await import('../../src/services/DeploymentService');
		const f = await fixture(async (turn) => {
			await writeFile(join(turn.cwd, 'src/owned.ts'), 'unverified change');
			git(turn.cwd, 'add', 'src/owned.ts');
			git(turn.cwd, 'commit', '-m', 'feat: fixture change without evidence');
		});
		await configure(f.root);
		const request = await approve(f);
		const execute = vi.spyOn(commands, 'deploymentCommand').mockResolvedValue('unexpected');
		const automatic = vi.spyOn(DeploymentService.prototype, 'enqueue').mockResolvedValue([]);
		await f.service.start(scopedRequest(f, request, scope));
		await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
		expect(execute).not.toHaveBeenCalled();
		expect(automatic).not.toHaveBeenCalled();
		expect(f.events).toContainEqual(
			expect.objectContaining({
				kind: 'failed',
				message: expect.stringContaining('completion audit')
			})
		);
		expect(f.events.some((event) => event.kind === 'finished')).toBe(false);
	},
	15000
);

function scopedRequest(
	f: Awaited<ReturnType<typeof fixture>>,
	request: Awaited<ReturnType<typeof approve>>,
	{ environment, task }: (typeof scopedChanges)[number]
) {
	return task
		? {
				intent: 'task' as const,
				category: 'functions' as const,
				mode: 'change' as const,
				projectId: f.session.projectId!,
				branch: 'main',
				commit: git(f.root, 'rev-parse', 'HEAD'),
				provider: request.provider,
				model: request.model,
				effort: request.effort,
				text: request.text,
				environment
			}
		: { ...request, environment };
}

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
