import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { taskInputSchema } from '../../../src/repositories/agents-providers/ModuleTaskRepository';
import type { ModuleTaskQueue } from '../../../src/repositories/agents-providers/ModuleTaskRepository.types';
import { expect } from '../../verificationExpect';
import { mockContexts } from './module-task-worker.test.fixtures';

export function quotedWorker(root: string, inputTokens: string | number | null) {
	return new ModuleTaskWorkerService(
		root,
		{
			run: async (input) => ({
				provider: input.provider,
				model: input.model,
				intelligence: input.intelligence,
				text: 'Done',
				reportedModel: input.model,
				usage: {
					inputTokens: Number(inputTokens),
					outputTokens: 20,
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					cacheWriteLongTokens: 0,
					reportedCostUsd: null
				}
			})
		},
		mockContexts().contexts
	);
}

export function expectSchemaGrants(input: Record<string, unknown>): void {
	const exactPath = 'src/routes/projects/[branch]/+page.svelte';
	const files = [exactPath, ...Array.from({ length: 63 }, (_, i) => 'src/exact/file-' + i + '.ts')];
	const grant = (id: string, assignedFiles: string[], role: string) =>
		taskInputSchema.parse({ ...input, id, assignedFiles, role });
	const implementation = grant('implementation-grant', files, 'implementation');
	const verification = grant('verification-grant', [exactPath], 'verification');
	expect(implementation.assignedFiles).toEqual(files);
	expect(implementation.role).toBe('implementation');
	expect(verification.role).toBe('verification');
}

export async function assertSafeTaskAssignment(
	service: ModuleTaskService,
	root: string,
	input: Record<string, unknown>
): Promise<void> {
	const id = String(input.id);
	const before = await service.repository.read();
	for (const worker of ['', 'Invalid ID', 'a'.repeat(151), undefined]) {
		await expect(service.assign(id, worker as string)).rejects.toThrow();
		expect(await service.repository.read()).toEqual(before);
	}
	await expect(service.assign('missing-task', 'worker-a')).rejects.toThrow();
	expect(await service.repository.read()).toEqual(before);
	const original = (await service.show(id)).task;
	const assigned = await service.assign(id, 'worker-a');
	expect(assigned.value).toEqual({ ...original, assignee: 'worker-a' });
	const assignedQueue = await service.repository.read();
	expect((await service.assign(id, 'worker-a')).commit).toBe(assignedQueue.commit);
	expect(await quotedWorker(root, 0).once('other-worker')).toEqual({ status: 'idle' });
	expect(await service.repository.read()).toEqual(assignedQueue);
	await assertAssignmentHistory(service, input, assignedQueue.data);
}

async function assertAssignmentHistory(
	service: ModuleTaskService,
	input: Record<string, unknown>,
	baseline: ModuleTaskQueue
): Promise<void> {
	const owner = await service.repository.owner();
	const variants = assignmentVariants(input, baseline, owner);
	for (const [name, apply] of variants) {
		await service.repository.update((queue) => apply(queue));
		const before = await service.repository.read();
		await expect(service.assign(String(input.id), 'worker-b'), name).rejects.toThrow();
		expect(await service.repository.read(), name).toEqual(before);
		await service.repository.update((queue) => {
			queue.tasks = structuredClone(baseline.tasks);
			queue.plans = structuredClone(baseline.plans);
		});
	}
}

function assignmentVariants(
	input: Record<string, unknown>,
	baseline: ModuleTaskQueue,
	owner: Awaited<ReturnType<ModuleTaskService['repository']['owner']>>
): Array<[string, (queue: ModuleTaskQueue) => void]> {
	const at = '2026-10-27T00:00:00.000Z';
	const token = '733715ae-dd63-4896-b94b-58a51d693a58';
	const claim = { worker: 'worker-a', token, startedAt: at, owner };
	const result = {
		provider: 'codex' as const,
		model: 'gpt-6-luna',
		intelligence: 'max',
		reportedModel: null,
		text: '',
		worktree: '',
		changedFiles: [],
		fallback: false,
		finishedAt: at,
		executions: []
	};
	const review = {
		attempt: token,
		verdict: 'incomplete' as const,
		reviewer: 'reviewer',
		feedback: 'Fix the result',
		at,
		provider: 'codex' as const,
		model: 'gpt-6-luna',
		intelligence: 'max',
		reportedModel: null
	};
	const plan = {
		feature: 'checkout',
		sourceCommit: baseline.tasks[0].sourceCommit,
		revision: 1,
		goal: 'Reliable checkout',
		tldr: 'Build validated orders.',
		pages: [],
		changes: [],
		tasks: [taskInputSchema.parse(input)],
		digest: 'a'.repeat(64)
	};
	return [
		[
			'running',
			(q) => {
				q.tasks[0].status = 'running';
			}
		],
		[
			'claim',
			(q) => {
				q.tasks[0].claim = claim;
			}
		],
		[
			'claim history',
			(q) => {
				q.tasks[0].claimHistory.push(claim);
			}
		],
		[
			'result',
			(q) => {
				q.tasks[0].result = result;
			}
		],
		[
			'attempt',
			(q) => {
				q.tasks[0].attempts.push(result);
			}
		],
		[
			'review',
			(q) => {
				q.tasks[0].reviews.push(review);
			}
		],
		[
			'repair',
			(q) => {
				q.tasks[0].repairCommit = baseline.tasks[0].sourceCommit;
			}
		],
		[
			'draft plan',
			(q) => {
				q.plans = [plan];
			}
		],
		[
			'historical approved plan',
			(q) => {
				q.plans = [
					{ ...plan, approval: { digest: plan.digest, reviewer: 'reviewer', approvedAt: at } },
					{ ...plan, revision: 2, tasks: [] }
				];
			}
		]
	];
}
