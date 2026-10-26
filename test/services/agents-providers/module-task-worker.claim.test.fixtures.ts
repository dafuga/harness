import { expect } from '../../verificationExpect';
import {
	claimedTask,
	pendingTaskResult
} from '../../../src/services/agents-providers/module-task-worker-service/taskClaim';

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
