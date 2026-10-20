import { expect, test, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { DeploymentService } from '../../src/services/DeploymentService';
import { deploymentFixture as fixture } from '../deployment-fixture';
test('promotion requires the same commit in every preceding environment and a reviewed single-use plan', async () => {
	const f = await fixture();
	const blocked = await f.service.plan({ environment: 'prod', commit: f.commit });
	expect(blocked.blockers.join(' ')).toMatch(/preprod/);
	await expect(f.service.deploy({ planId: blocked.id })).rejects.toThrow(/preprod/);
	for (const environment of ['dev', 'stage', 'preprod', 'prod'] as const) {
		const plan = await f.service.plan({ environment, commit: f.commit });
		expect(plan.blockers).toEqual([]);
		const receipt = await f.service.deploy({ planId: plan.id });
		expect(receipt).toMatchObject({ environment, commit: f.commit, deploymentId: 'receipt-1' });
		await expect(f.service.deploy({ planId: plan.id })).rejects.toThrow(/review/);
	}
	expect(f.execute).toHaveBeenCalledTimes(9);
	expect((await f.service.status()).every((item) => item.receipt?.commit === f.commit)).toBe(true);
});
test('changed configuration, source or project invalidates confirmation without deploying', async () => {
	const f = await fixture();
	const plan = await f.service.plan({ environment: 'dev', commit: f.commit });
	f.config.targets.dev.name = 'changed-target';
	await expect(f.service.deploy({ planId: plan.id })).rejects.toThrow(/changed/);
	expect(f.plugin.deploy).not.toHaveBeenCalled();
	const next = await f.service.plan({ environment: 'dev', commit: f.commit });
	f.git('commit', '--allow-empty', '-m', 'feat: moved');
	await expect(f.service.deploy({ planId: next.id })).rejects.toThrow(/changed|source/);
	const last = await f.service.plan({ environment: 'dev', commit: f.git('rev-parse', 'HEAD') });
	f.session.projectId = 'another';
	await expect(f.service.deploy({ planId: last.id })).rejects.toThrow(/project/);
	expect(f.plugin.deploy).not.toHaveBeenCalled();
});
test('failed checks or health verification never advance environment state', async () => {
	const f = await fixture();
	f.execute.mockRejectedValueOnce(new Error('check failed'));
	const plan = await f.service.plan({ environment: 'dev', commit: f.commit });
	await expect(f.service.deploy({ planId: plan.id })).rejects.toThrow(/check failed/);
	expect(f.plugin.deploy).not.toHaveBeenCalled();
	expect((await f.service.status())[0].receipt).toBeNull();
	const service = new DeploymentService(f.session, {
		plugin: f.plugin,
		execute: f.execute,
		health: async () => false
	});
	const next = await service.plan({ environment: 'dev', commit: f.commit });
	await expect(service.deploy({ planId: next.id })).rejects.toThrow(/health/);
	expect((await service.status())[0].receipt).toBeNull();
});

test('automatic promotion allows preprod, refuses production and confirmations expire', async () => {
	const f = await fixture();
	for (const environment of ['dev', 'stage', 'preprod'] as const)
		await f.service.automatic({ environment, commit: f.commit });
	await expect(f.service.automatic({ environment: 'prod', commit: f.commit })).rejects.toThrow(
		/Deploy UI/
	);
	const plan = await f.service.plan({ environment: 'dev', commit: f.commit });
	const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000);
	try {
		await expect(f.service.deploy({ planId: plan.id })).rejects.toThrow(/review/);
	} finally {
		clock.mockRestore();
	}
	expect(f.plugin.deploy).toHaveBeenCalledTimes(3);
});
test('source changes during upload cannot become a verified environment receipt', async () => {
	const f = await fixture();
	vi.mocked(f.plugin.deploy).mockImplementationOnce(async () => {
		f.git('commit', '--allow-empty', '-m', 'feat: source advanced during upload');
		return { deploymentId: 'uploaded', url: 'https://example.invalid' };
	});
	const plan = await f.service.plan({ environment: 'dev', commit: f.commit });
	await expect(f.service.deploy({ planId: plan.id })).rejects.toThrow(/changed during deployment/);
	expect((await f.service.status())[0].receipt).toBeNull();
});

test('production promotes the reviewed preprod source after the checkout advances, with live progress', async () => {
	const f = await fixture();
	for (const environment of ['dev', 'stage', 'preprod', 'prod'] as const) {
		const plan = await f.service.plan({ environment, commit: f.commit });
		await f.service.deploy({ planId: plan.id });
	}
	f.git('commit', '--allow-empty', '-m', 'feat: first promoted change');
	f.git('commit', '--allow-empty', '-m', 'feat: second promoted change');
	const preprod = f.git('rev-parse', 'HEAD');
	for (const environment of ['dev', 'stage', 'preprod'] as const)
		await f.service.automatic({ environment, commit: preprod });
	f.git('commit', '--allow-empty', '-m', 'feat: newer local change');
	const head = f.git('rev-parse', 'HEAD');
	const plan = await f.service.plan({ environment: 'prod', commit: head });
	expect(plan).toMatchObject({
		commit: preprod,
		promotion: { commitsBehind: 2, production: { commit: f.commit }, preprod: { commit: preprod } },
		blockers: []
	});
	f.execute.mockImplementation(async (command) => {
		expect(
			execFileSync('git', ['rev-parse', 'HEAD'], { cwd: command.cwd, encoding: 'utf8' }).trim()
		).toBe(preprod);
		expect(command.cwd).not.toBe(f.root);
		const progress = await f.service.progress({ planId: plan.id });
		expect(['preparing', 'checking', 'building']).toContain(progress?.phase);
		return 'passed';
	});
	await f.service.deploy({ planId: plan.id });
	expect(f.plugin.deploy).toHaveBeenLastCalledWith(f.config.targets.prod, {
		root: expect.any(String),
		commit: preprod
	});
	expect((await f.service.progress({ planId: plan.id }))?.phase).toBe('complete');
	expect(f.git('rev-parse', 'HEAD')).toBe(head);
	expect(f.git('worktree', 'list', '--porcelain').match(/worktree /g)).toHaveLength(1);
	const current = await f.service.plan({ environment: 'prod', commit: head });
	expect(current.promotion?.commitsBehind).toBe(0);
	expect(current.blockers.join(' ')).toMatch(/up to date/);
});
