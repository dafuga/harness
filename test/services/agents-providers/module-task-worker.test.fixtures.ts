/** Private collaborators for the owning worker method matrix. */
import { afterEach, beforeEach, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskAnalyticsService } from '../../../src/services/agents-providers/ModuleTaskAnalyticsService';
import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import * as taskWorkspaceApi from '../../../src/services/agents-providers/module-task-worker-service/taskWorkspace';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
	ModuleTask,
	TaskRunInput,
	TaskRunScope,
	WorkerContextCall
} from './module-task-worker.test.types';

export async function reviewFixture() {
	const f = await moduleTaskFixture();
	const service = new ModuleTaskService(f.root);
	await service.feature({
		id: 'checkout',
		goal: 'Reliable checkout',
		tldr: 'Build validated orders.'
	});
	const input = JSON.parse(
		await readFile(
			await f.input({
				model: 'auto',
				role: 'implementation',
				assignedFiles: ['src/orders.ts'],
				verificationFiles: ['test/services/agents-providers/module-task-worker.test.ts']
			}),
			'utf8'
		)
	);
	await service.add(input);
	const runInputs: TaskRunInput[] = [];
	const contexts = mockContexts();
	const worker = new ModuleTaskWorkerService(f.root, reviewRunner(runInputs), contexts.contexts);
	return { f, service, worker, contexts, runInputs };
}

export async function exclusiveWorkerFixture() {
	const f = await moduleTaskFixture();
	const service = new ModuleTaskService(f.root);
	await service.feature({
		id: 'checkout',
		goal: 'Reliable checkout',
		tldr: 'Build validated orders.'
	});
	const input = JSON.parse(await readFile(await f.input({ assignee: 'owner' }), 'utf8'));
	await service.add(input);
	const contexts = mockContexts();
	const worker = new ModuleTaskWorkerService(
		f.root,
		{
			run: async (runInput) => {
				await writeFile(join(runInput.cwd, 'src/orders.ts'), 'export const orders=2;');
				return {
					provider: runInput.provider,
					model: runInput.model,
					intelligence: runInput.intelligence,
					text: 'Implemented',
					reportedModel: runInput.model
				};
			}
		},
		contexts.contexts
	);
	return { f, service, input, worker };
}

function reviewRunner(runInputs: TaskRunInput[]) {
	let count = 0,
		quota = true;
	return {
		run: async (input: TaskRunInput) => {
			runInputs.push(input);
			if (quota) {
				quota = false;
				throw Object.assign(new Error('quota'), { quotaRejected: true });
			}
			if (count++)
				expect(await readFile(join(input.cwd, 'src/orders.ts'), 'utf8')).toContain('orders = 2');
			await writeFile(
				join(input.cwd, 'src/orders.ts'),
				'export const orders = 2;\n' + (count > 1 ? '// Fixed review feedback\n' : '')
			);
			return {
				provider: input.provider,
				model: input.model,
				intelligence: input.intelligence,
				reportedModel: input.model,
				text: 'Done',
				usage: {
					inputTokens: 100,
					outputTokens: 20,
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					cacheWriteLongTokens: 0,
					reportedCostUsd: 0.002
				}
			};
		}
	};
}

export function mockContexts(fail = false) {
	const calls: WorkerContextCall[] = [];
	const scopes: TaskRunScope[] = [];
	const state = { cleanups: 0 };
	return {
		calls,
		scopes,
		state,
		contexts: {
			create: async (task: ModuleTask, worktree: string, files: string[]) => {
				calls.push({ task, worktree, files: [...files] });
				if (fail) throw new Error('private sentinel /Users/private/.ssh/id_rsa');
				const scope: TaskRunScope = {
					files: [...files],
					snapshot: '/sealed/snapshot',
					scratch: '/task-scratch',
					readPaths: ['/sealed/cli'],
					protectedPaths: [],
					binDirectory: '/sealed/cli'
				};
				scopes.push(scope);
				return {
					scope,
					binDirectory: '/sealed/cli',
					cleanup: async () => {
						state.cleanups++;
					}
				};
			}
		}
	};
}

export async function seededWorkerFixture(
	options: { model?: string; provider?: 'claude' | 'codex'; intelligence?: string } = {}
) {
	const f = await moduleTaskFixture();
	const service = new ModuleTaskService(f.root);
	await service.feature({
		id: 'checkout',
		goal: 'Reliable checkout',
		tldr: 'Build validated orders.'
	});
	const input = JSON.parse(await readFile(await f.input(options), 'utf8'));
	await service.add(input);
	return { f, service, input, contexts: mockContexts() };
}

export async function workspaceFailureFixture() {
	const { f, service, input, contexts } = await seededWorkerFixture({
		model: 'gpt-6-luna',
		provider: 'codex',
		intelligence: 'max'
	});
	const taskWorkspaceSpy = vi
		.spyOn(taskWorkspaceApi, 'taskWorkspace')
		.mockRejectedValue(new Error('synthetic workspace preparation failure'));
	const snapshotSpy = vi.spyOn(taskWorkspaceApi, 'snapshotTaskWork').mockResolvedValue(undefined);
	const runs = { calls: 0 };
	const worker = new ModuleTaskWorkerService(
		f.root,
		{
			run: async (runInput) => {
				runs.calls++;
				return {
					provider: runInput.provider,
					model: runInput.model,
					intelligence: runInput.intelligence,
					text: 'Unexpected runner call',
					reportedModel: runInput.model
				};
			}
		},
		contexts.contexts
	);
	return { f, service, input, contexts, taskWorkspaceSpy, snapshotSpy, runs, worker };
}

export function isolateAnalyticsSync() {
	beforeEach(() => vi.spyOn(ModuleTaskAnalyticsService.prototype, 'sync').mockResolvedValue(0));
	afterEach(() => vi.restoreAllMocks());
}

export function assertWorkspaceNotRun(contexts: ReturnType<typeof mockContexts>, calls: number[]) {
	expect(calls).toEqual([0, 0]);
	expect([contexts.calls.length, contexts.scopes.length, contexts.state.cleanups]).toEqual([
		0, 0, 0
	]);
}

export function assertAcceptedExecutions(task: ModuleTask, runInputs: TaskRunInput[]) {
	expect(runInputs[2]).toMatchObject({
		provider: 'claude',
		model: 'claude-haiku-5-5',
		intelligence: 'medium'
	});
	expect(task.attempts[0]?.executions?.[1]).toMatchObject({
		provider: 'codex',
		model: 'gpt-6-luna',
		intelligence: 'max',
		apiCost: { usd: 0.002, basis: 'cli-reported' }
	});
	expect(task.result?.executions?.[0]).toMatchObject({
		provider: 'claude',
		model: 'claude-haiku-5-5',
		intelligence: 'medium',
		apiCost: { usd: 0.002, basis: 'cli-reported' }
	});
}
