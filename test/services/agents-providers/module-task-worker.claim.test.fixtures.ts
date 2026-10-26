import { expect } from '../../verificationExpect';
import {
	claimedTask,
	pendingTaskResult
} from '../../../src/services/agents-providers/module-task-worker-service/taskClaim';
import { ModuleTaskRepository } from '../../../src/repositories/agents-providers/ModuleTaskRepository';
import {
	assertWorkspaceNotRun,
	exclusiveWorkerFixture,
	workspaceFailureFixture
} from './module-task-worker.test.fixtures';

const owner = { workspace: '00000000-0000-4000-8000-000000000001', pid: 1, startedAt: 'synthetic' };

function candidate(base: Parameters<typeof claimedTask>[0]['tasks'][number], id: string) {
	return {
		...structuredClone(base),
		id,
		status: 'queued' as const,
		assignee: 'owner',
		module: { ...base.module, id: `service.${id}`, files: [`src/${id}.ts`] },
		assignedFiles: [`src/${id}.ts`],
		dependsOn: [] as string[]
	};
}

function queueOf(tasks: Parameters<typeof claimedTask>[0]['tasks']) {
	return { schemaVersion: 1 as const, features: [tasks[0].feature], tasks };
}

function acceptedResult(checkpointCommit: string) {
	return {
		...pendingTaskResult(
			{ provider: 'codex', model: 'gpt-6-luna', intelligence: 'max' },
			'/synthetic'
		),
		checkpointCommit
	};
}

function assertDependencies(base: Parameters<typeof claimedTask>[0]['tasks'][number]) {
	const outcomes = [];
	for (const status of ['missing', 'queued', 'running', 'review', 'failed', 'accepted'] as const) {
		const dependent = { ...candidate(base, 'dependent'), dependsOn: ['prerequisite', 'accepted'] };
		const independent = candidate(base, 'independent');
		const accepted = {
			...candidate(base, 'accepted'),
			status: 'accepted' as const,
			result: acceptedResult(base.sourceCommit)
		};
		const prerequisites =
			status === 'missing'
				? []
				: [
						{
							...candidate(base, 'prerequisite'),
							status,
							result: accepted.result,
							assignee: 'another-worker'
						}
					];
		const queue = queueOf([dependent, independent, accepted, ...prerequisites]);
		const before = structuredClone(prerequisites);
		const prepared: string[] = [];
		const selected = claimedTask(queue, 'owner', [], owner, (task) => {
			prepared.push(task.id);
		});
		outcomes.push([status, selected?.id, dependent.status, independent.status, prepared]);
		expect(prerequisites).toEqual(before);
		expect(selected?.claim).toMatchObject({ worker: 'owner', owner, token: expect.any(String) });
		expect(claimedTask(queue, 'owner', [selected!.module.id], owner)).toBeNull();
	}
	expect(outcomes).toEqual([
		...['missing', 'queued', 'running', 'review', 'failed'].map((status) => [
			status,
			'independent',
			'queued',
			'running',
			['independent']
		]),
		['accepted', 'dependent', 'running', 'queued', ['dependent']]
	]);
}

function assertFileExclusion(base: Parameters<typeof claimedTask>[0]['tasks'][number]) {
	for (const files of [['src/shared.ts'], ['src/shared.ts', 'src/additional.ts']]) {
		const blocked = candidate(base, 'blocked');
		blocked.module.files = ['src/shared.ts'];
		blocked.assignedFiles = ['src/shared.ts'];
		const running = { ...candidate(base, 'running'), status: 'running' as const };
		running.module.files = files;
		running.assignedFiles = files;
		const independent = candidate(base, 'independent');
		const queue = queueOf([blocked, independent, running]);
		const before = structuredClone([blocked, running]);
		expect(claimedTask(queue, 'owner', [], owner)?.id).toBe('independent');
		expect([blocked, running]).toEqual(before);
		expect(claimedTask(queue, 'owner', [], owner)).toBeNull();
	}
	const running = { ...candidate(base, 'running'), status: 'running' as const };
	const neighbor = candidate(base, 'neighbor');
	neighbor.module.files = ['src/running.tsx'];
	neighbor.assignedFiles = neighbor.module.files;
	expect(claimedTask(queueOf([neighbor, running]), 'owner', [], owner)?.id).toBe('neighbor');
}

export function assertDependencyClaims(base: Parameters<typeof claimedTask>[0]['tasks'][number]) {
	assertDependencies(base);
	assertFileExclusion(base);
	const task = candidate(base, 'preflight');
	const queue = queueOf([task]);
	const before = structuredClone(queue);
	expect(() =>
		claimedTask(queue, 'owner', [], owner, () => {
			throw new Error('invalid preparation');
		})
	).toThrow('invalid preparation');
	expect(queue).toEqual(before);
}

export async function assertWorkspaceFailure() {
	const { f, service, input, contexts, taskWorkspaceSpy, snapshotSpy, runs, worker } =
		await workspaceFailureFixture();
	try {
		const outcome = await worker.once('owner').catch(() => undefined);
		const task = (await service.show(input.id)).task;
		expect([outcome?.status, task.status]).toEqual(['failed', 'failed']);
		expect(task.result).toMatchObject({
			provider: 'codex',
			model: 'gpt-6-luna',
			intelligence: 'max',
			worktree: '',
			changedFiles: [],
			error: expect.any(String),
			executions: []
		});
		expect(task.result?.error).not.toBe('');
		expect(task.result?.usage).toBeUndefined();
		expect(taskWorkspaceSpy).toHaveBeenCalledOnce();
		assertWorkspaceNotRun(contexts, [snapshotSpy.mock.calls.length, runs.calls]);
	} finally {
		await f.dispose();
	}
}

export async function assertApprovedWorkerScope() {
	const { f, service, input, worker } = await exclusiveWorkerFixture();
	try {
		await service.add({ ...input, id: 'unrelated-task', title: 'Unrelated work' });
		const repository = new ModuleTaskRepository(f.root);
		const task = (await service.show(input.id)).task;
		const digest = 'a'.repeat(64);
		const plan = {
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
		};
		await repository.update((queue) => {
			queue.tasks.reverse();
			queue.plans = [plan];
		});
		const data = (await repository.read()).data;
		const record = data.tasks.find((entry) => entry.id === input.id)!;
		const scope = { plan: data.plans![0], feature: record.feature, records: [record] };
		const approved = worker as unknown as {
			onceApproved(
				workerId: string,
				scope: unknown,
				signal?: AbortSignal
			): ReturnType<typeof worker.once>;
		};
		expect(typeof approved.onceApproved).toBe('function');
		await assertApprovedRejections(repository, approved, scope);
		const mutable = structuredClone(scope);
		const pending = approved.onceApproved('owner', mutable);
		mutable.records[0].module.files[0] = 'src/foreign.ts';
		expect((await pending).status).toBe('review');
		expect((await service.show('unrelated-task')).task.status).toBe('queued');
		expect((await service.show(input.id)).task.result?.changedFiles).toEqual(['src/orders.ts']);
	} finally {
		await f.dispose();
	}
}

async function assertApprovedRejections(
	repository: ModuleTaskRepository,
	worker: { onceApproved(worker: string, scope: unknown, signal?: AbortSignal): Promise<unknown> },
	scope: {
		plan: NonNullable<Awaited<ReturnType<ModuleTaskRepository['read']>>['data']['plans']>[number];
		feature: unknown;
		records: Array<Parameters<typeof claimedTask>[0]['tasks'][number]>;
	}
) {
	const before = (await repository.read()).data;
	const wrongRecord = structuredClone(scope);
	wrongRecord.records[0].instructions += ' altered';
	const extra = structuredClone(scope);
	extra.records.push(before.tasks.find((task) => task.id === 'unrelated-task')!);
	for (const invalid of [
		{ ...scope, plan: { ...scope.plan, approval: undefined } },
		{ ...scope, plan: { ...scope.plan, digest: 'b'.repeat(64) } },
		wrongRecord,
		extra
	])
		await expect(worker.onceApproved('owner', invalid)).rejects.toThrow();
	await expect(worker.onceApproved('owner', scope, AbortSignal.abort())).rejects.toThrow();
	expect((await repository.read()).data).toEqual(before);
}
