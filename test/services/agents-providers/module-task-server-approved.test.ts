import { expect, test, vi } from 'vitest';
import { feature, makeFixture } from './fixtures/module-task-server.fixtures';
import { approvedPlan } from './fixtures/module-task-server-approved.fixtures';
import type { ApprovedTaskScope } from '../../../src/helpers/agents-providers/moduleTaskApprovedSubmission.types';
import { ModuleTaskServerService } from '../../../src/services/agents-providers/ModuleTaskServerService';
import { ModuleTaskRepository } from '../../../src/repositories/agents-providers/ModuleTaskRepository';
import type { requireModuleData } from '../../../src/services/git-source-history/module-data-service/moduleDataAdmission';
import { exclusiveWorkerFixture } from './module-task-worker.test.fixtures';

test('approved dispatch verifies the plan and limits parallel workers to its exact scope', async () => {
	const approved = approvedPlan(),
		f = makeFixture({ approved });
	const request = { feature: feature.id, expectedDigest: approved.digest };
	const controller = new AbortController();
	let active = 0,
		peak = 0;
	let release!: () => void;
	const gate = new Promise<void>((resolve) => (release = resolve));
	const onceApproved = vi.fn(async () => {
		active++;
		peak = Math.max(peak, active);
		await gate;
		active--;
		return { status: 'idle' as const };
	});
	f.collaborators.worker.onceApproved = onceApproved;
	expect(typeof f.service.runApproved).toBe('function');
	const execution = {
		worker: 'worker-one',
		parallelism: 2,
		signal: controller.signal
	};
	const run = f.service.runApproved(request, execution);
	execution.worker = 'mutated-worker';
	execution.parallelism = 8;
	await vi.waitFor(() => expect(onceApproved).toHaveBeenCalledTimes(2));
	expect(peak).toBe(2);
	expect(f.collaborators.plans.approved).toHaveBeenCalledTimes(2);
	expect(f.collaborators.worker.once).not.toHaveBeenCalled();
	for (const [worker, scope, signal] of onceApproved.mock.calls as unknown as Array<
		[string, ApprovedTaskScope, AbortSignal]
	>) {
		expect(worker).toBe('worker-one');
		expect(signal).toBe(controller.signal);
		expect(scope.plan).toEqual(approved);
		expect(scope.feature).toEqual(feature);
		expect(scope.records.map((record: { id: string }) => record.id)).toEqual([
			'task-one',
			'task-two'
		]);
	}
	release();
	expect(await run).toMatchObject({
		submission: { created: ['task-one', 'task-two'], reused: [] },
		results: [{ status: 'idle' }, { status: 'idle' }]
	});
});

test('approved dispatch rejects unsafe requests before launching any worker', async () => {
	const approved = approvedPlan(),
		request = { feature: feature.id, expectedDigest: approved.digest };
	for (const mode of ['missing', 'stale', 'cancelled', 'parallelism', 'readiness'] as const) {
		const f = makeFixture(mode === 'missing' ? {} : { approved });
		const onceApproved = vi.fn(async () => ({ status: 'idle' as const }));
		f.collaborators.worker.onceApproved = onceApproved;
		const controller = new AbortController();
		if (mode === 'cancelled') controller.abort();
		if (mode === 'readiness')
			f.collaborators.plans.approved
				.mockResolvedValueOnce(approved)
				.mockRejectedValueOnce(new Error('stale readiness'));
		const input = mode === 'stale' ? { ...request, expectedDigest: 'd'.repeat(64) } : request;
		await expect(
			f.service.runApproved(input, {
				worker: 'worker-one',
				parallelism: mode === 'parallelism' ? 0 : 2,
				signal: controller.signal
			})
		).rejects.toThrow();
		expect(onceApproved).not.toHaveBeenCalled();
	}
});

test('a failed approved worker is reported only after its concurrent sibling settles', async () => {
	const approved = approvedPlan(),
		f = makeFixture({ approved });
	let release!: () => void;
	const gate = new Promise<void>((resolve) => (release = resolve));
	const onceApproved = vi
		.fn()
		.mockRejectedValueOnce(new Error('synthetic worker failure'))
		.mockImplementationOnce(async () => {
			await gate;
			return { status: 'idle' };
		});
	f.collaborators.worker.onceApproved = onceApproved;
	let settled = false;
	const run = f.service.runApproved(
		{ feature: feature.id, expectedDigest: approved.digest },
		{ worker: 'worker-one', parallelism: 2, signal: new AbortController().signal }
	);
	void run.then(
		() => (settled = true),
		() => (settled = true)
	);
	await vi.waitFor(() => expect(onceApproved).toHaveBeenCalledTimes(2));
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(settled).toBe(false);
	release();
	await expect(run).rejects.toThrow('synthetic worker failure');
});

test('approved server and scoped worker cooperate through the committed Git queue', async () => {
	const { f, service, input, worker } = await exclusiveWorkerFixture();
	try {
		const task = (await service.show(input.id)).task;
		const digest = 'a'.repeat(64);
		const repository = new ModuleTaskRepository(f.root);
		await repository.update((queue) => {
			queue.plans = [
				{
					feature: task.feature.id,
					sourceCommit: task.sourceCommit,
					revision: 1,
					goal: task.feature.goal,
					tldr: task.feature.tldr,
					pages: [],
					changes: [],
					tasks: [input],
					digest,
					approval: { digest, reviewer: 'owner', approvedAt: '2026-10-27T00:00:00.000Z' }
				}
			];
		});
		const plan = (await repository.read()).data.plans![0];
		const server = new ModuleTaskServerService(f.root, {
			worker,
			plans: { approved: async () => structuredClone(plan) },
			requireMetadata: async () => ({}) as Awaited<ReturnType<typeof requireModuleData>>
		});
		const result = await server.runApproved(
			{ feature: plan.feature, expectedDigest: digest },
			{ worker: 'owner', parallelism: 2, signal: new AbortController().signal }
		);
		expect(result.submission).toMatchObject({ created: [], reused: [input.id] });
		expect(result.results.map((item) => (item as { status: string }).status).sort()).toEqual([
			'idle',
			'review'
		]);
		expect((await service.show(input.id)).task.result?.changedFiles).toEqual(['src/orders.ts']);
	} finally {
		await f.dispose();
	}
});
