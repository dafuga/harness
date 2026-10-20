import { expect, test, vi } from 'vitest';
import { deploymentFixture } from '../deployment-fixture';
import { reviewDeployment } from '../../src/utils/reviewDeployment';
const nextCommit = (f: Awaited<ReturnType<typeof deploymentFixture>>) => {
	f.git('commit', '--allow-empty', '-m', 'feat: next pipeline');
	return f.git('rev-parse', 'HEAD');
};
async function expectReceipts(f: Awaited<ReturnType<typeof deploymentFixture>>, commits: string[]) {
	expect((await f.service.status()).map((item) => item.receipt?.commit)).toEqual(commits);
}

test('prod, preprod and stage jobs overlap from independent captured sources', async () => {
	const f = await deploymentFixture();
	for (const environment of ['dev', 'stage', 'preprod'] as const)
		await f.service.automatic({ environment, commit: f.commit });
	const entered: string[] = [],
		releases = new Map<string, () => void>();
	let released = false;
	vi.mocked(f.plugin.deploy).mockImplementation(async (target, source) => {
		const key = target.environment + ':' + source.commit;
		entered.push(key);
		if (
			!released &&
			(['prod', 'preprod'].includes(target.environment) ||
				(target.environment === 'stage' &&
					source.commit !== f.commit &&
					releases.has('hold-stage')))
		)
			await new Promise<void>((resolve) => releases.set(key, resolve));
		return { deploymentId: key, url: 'https://example.invalid' };
	});
	const prod = await f.service.start({
		planId: (await f.service.plan({ environment: 'prod', commit: f.commit })).id
	});
	const preprod = nextCommit(f);
	await f.service.enqueue({ environment: 'preprod', commit: preprod });
	let stage = '';
	try {
		await expect.poll(() => entered.includes('preprod:' + preprod), { timeout: 10000 }).toBe(true);
		releases.set('hold-stage', () => {});
		stage = nextCommit(f);
		await f.service.enqueue({ environment: 'stage', commit: stage });
		await expect.poll(() => entered.includes('stage:' + stage), { timeout: 10000 }).toBe(true);
		expect(
			f.service
				.activities()
				.filter((job) => !job.finishedAt)
				.map((job) => job.environment)
				.sort()
		).toEqual(['preprod', 'prod', 'stage']);
		expect(f.session.busy).toBe(false);
	} finally {
		released = true;
		for (const release of releases.values()) release();
	}
	await f.activities.idle();
	expect((await f.activities.wait(prod.id)).commit).toBe(f.commit);
	await expectReceipts(f, [stage, stage, preprod, f.commit]);
}, 20000);

test('equal targets queue while unrelated targets remain independent', async () => {
	const f = await deploymentFixture();
	await f.service.automatic({ environment: 'dev', commit: f.commit });
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	let uploads = 0;
	vi.mocked(f.plugin.deploy).mockImplementation(async () => {
		if (++uploads === 1) await gate;
		return { deploymentId: String(uploads), url: 'https://example.invalid' };
	});
	const plan = () => f.service.plan({ environment: 'stage', commit: f.commit });
	const one = await f.service.start({ planId: (await plan()).id });
	const two = await f.service.start({ planId: (await plan()).id });
	try {
		await expect.poll(() => uploads, { timeout: 10000 }).toBe(1);
		expect(f.service.activities().find((job) => job.id === two.id)?.phase).toBe('queued');
		expect(f.session.busy).toBe(false);
	} finally {
		release();
	}
	await Promise.all([f.activities.wait(one.id), f.activities.wait(two.id)]);
	expect(uploads).toBe(2);
});

test('a failed lower job stops its dependent environments without unhandled promises', async () => {
	const f = await deploymentFixture();
	f.execute.mockRejectedValueOnce(new Error(`install failed in ${f.root}, token=private-value`));
	const jobs = await f.service.enqueue({ environment: 'prod', commit: f.commit });
	expect(jobs.map((job) => job.environment)).toEqual(['dev', 'stage', 'preprod']);
	await f.activities.idle();
	expect(f.service.activities().map((job) => job.phase)).toEqual(['failed', 'failed', 'failed']);
	expect(f.service.activities()[0].error).toMatch(/lower-environment/);
	expect(JSON.stringify(f.service.activities())).not.toMatch(/private-value|token=/);
	expect(JSON.stringify(f.service.activities())).not.toContain(f.root);
	expect(f.service.activities()[0].startedAt).toBeNull();
	expect(f.plugin.deploy).not.toHaveBeenCalled();
});

test('recent history is bounded without discarding active work or exposing mutable job objects', async () => {
	const f = await deploymentFixture();
	const receipt = await f.service.automatic({ environment: 'dev', commit: f.commit });
	const reviewed = await reviewDeployment(
		f.root,
		{ environment: 'dev', commit: f.commit },
		{
			plugin: f.plugin,
			projectId: f.session.projectId
		}
	);
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const active = f.activities.schedule(
		{ ...reviewed, target: { ...reviewed.target!, name: 'other' } },
		async () => {
			await gate;
			return receipt;
		}
	);
	try {
		for (let index = 0; index < 70; index++) {
			const job = f.activities.schedule(
				{ ...reviewed, plan: { ...reviewed.plan, id: String(index) } },
				async () => receipt
			);
			await f.activities.wait(job.id);
		}
		const jobs = f.activities.list();
		expect(jobs.filter((job) => job.finishedAt)).toHaveLength(64);
		expect(jobs.some((job) => job.id === active.id && !job.finishedAt)).toBe(true);
		jobs.find((job) => job.id === active.id)!.commit = 'changed';
		expect(f.activities.progress(active.id, f.root)?.commit).toBe(f.commit);
	} finally {
		release();
	}
	await f.activities.wait(active.id);
});
