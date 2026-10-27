import { test } from 'vitest';
import { assertDependencyWorker } from './module-task-dependency-worker.test.fixtures';
import {
	assertApprovedWorkerScope,
	assertDependencyClaims,
	assertWorkspaceFailure
} from './module-task-worker.claim.test.fixtures';
import { expect } from '../../verificationExpect';
import { assertWorkspacePlacement } from './module-task-workspace.test.fixtures';
import {
	assertAcceptedExecutions,
	exclusiveWorkerFixture,
	isolateAnalyticsSync,
	mockContexts,
	reviewFixture,
	seededWorkerFixture
} from './module-task-worker.test.fixtures';
import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';
import { observedTaskOperation } from '../../support/taskProfiles';
isolateAnalyticsSync();
test('module filters and assignment claims select once, then preserve changes for review', async () => {
	const { f, service, input, worker } = await exclusiveWorkerFixture();
	try {
		await assertWorkspacePlacement(f.root, (await service.show(input.id)).task);
		assertDependencyClaims((await service.show(input.id)).task);
		expect((await worker.once('other')).status).toBe('idle');
		expect((await worker.once('owner', ['service.other'])).status).toBe('idle');
		const outcomes = await observedTaskOperation(
			'service.agents-providers-module-task-worker',
			'exclusive-dispatch-with-synthetic-runner',
			() => Promise.all([worker.once('owner'), worker.once('owner')])
		);
		expect(outcomes.map((x) => x.status).sort()).toEqual(['idle', 'review']);
		expect((await service.show(input.id)).task.result?.changedFiles).toEqual(['src/orders.ts']);
	} finally {
		await f.dispose();
	}
});
test('worker passes the exact prepared scope through quota fallback', async () => {
	await assertDependencyWorker();
	const { f, service, worker, contexts, runInputs } = await reviewFixture();
	try {
		await worker.once('owner');
		const task = (await service.show('orders-validation')).task;
		const files = service.prepare(task, (await service.list()).commit!).files;
		expect(files).toEqual(['src/orders.ts']);
		expect(files).not.toContain('test/services/agents-providers/module-task-worker.test.ts');
		expect([
			files,
			contexts.calls[0]?.task.sourceCommit === task.sourceCommit,
			runInputs
				.slice(0, 2)
				.map(({ provider, model, intelligence, scope }) => [provider, model, intelligence, scope]),
			contexts.state.cleanups
		]).toEqual([
			['src/orders.ts'],
			true,
			[
				['claude', 'claude-haiku-5-5', 'medium', contexts.scopes[0]],
				['codex', 'gpt-6-luna', 'max', contexts.scopes[0]]
			],
			1
		]);
	} finally {
		await f.dispose();
	}
}, 15_000);
test('incomplete review commits a repair base, requeues once, and keeps prior work and contract', async () => {
	const { f, service, worker, contexts, runInputs } = await reviewFixture();
	try {
		await worker.once('owner');
		const first = (await service.show('orders-validation')).task;
		const files = service.prepare(first, (await service.list()).commit!).files;
		expect(contexts.calls[0]?.files).toEqual(files);
		const review = {
			attempt: first.claim!.token,
			verdict: 'incomplete',
			reviewer: 'tester',
			feedback: 'Keep the implementation and address review feedback.'
		};
		await service.review(first.id, review);
		await expect(service.review(first.id, review)).rejects.toThrow(/review|attempt|stale/i);
		const queued = (await service.show(first.id)).task;
		expect(queued).toMatchObject({
			status: 'queued',
			contractHash: first.contractHash,
			reviews: [{ verdict: 'incomplete', attempt: first.claim!.token }]
		});
		expect(await f.git.run(['show', `${queued.repairCommit}:src/orders.ts`])).toContain(
			'orders = 2'
		);
		await worker.once('owner');
		expect(contexts.calls[1]).toMatchObject({
			task: { sourceCommit: queued.repairCommit },
			files
		});
		expect(runInputs[2]?.scope).toBe(contexts.scopes[1]);
		expect(contexts.state.cleanups).toBe(2);
		const second = (await service.show(first.id)).task;
		await service.review(first.id, {
			attempt: second.claim!.token,
			verdict: 'accepted',
			reviewer: 'tester'
		});
		const accepted = (await service.show(first.id)).task;
		expect(accepted.status).toBe('accepted');
		expect(accepted.reviews).toHaveLength(2);
		expect(accepted.attempts).toHaveLength(1);
		assertAcceptedExecutions(accepted, runInputs);
		expect(await f.git.run(['rev-parse', 'HEAD'])).toBe(f.source);
	} finally {
		await f.dispose();
	}
});
test('context cleanup waits for runner rejection and cancellation settlement', async () => {
	const outcomes: string[] = [];
	for (const outcome of ['reject', 'cancel'] as const) {
		const { f, contexts } = await seededWorkerFixture();
		const controller = new AbortController();
		let release = () => {};
		let started = () => {};
		const running = new Promise<void>((resolve) => (started = resolve));
		try {
			const worker = new ModuleTaskWorkerService(
				f.root,
				{
					run: async () => {
						if (outcome === 'reject') throw new Error('synthetic failure');
						return new Promise<never>((_, reject) => {
							started();
							release = () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
						});
					}
				},
				contexts.contexts
			);
			const pending = worker.once('owner', [], controller.signal);
			if (outcome === 'cancel') {
				await running;
				controller.abort();
				expect(contexts.state.cleanups).toBe(0);
				release();
			}
			outcomes.push(`${outcome}:${(await pending).status}:${contexts.state.cleanups}`);
		} finally {
			await f.dispose();
		}
	}
	expect(outcomes).toEqual(['reject:failed:1', 'cancel:failed:1']);
});

test('context rejection is safe and an aborted preclaim does not write the queue', async () => {
	const { f, service, input } = await seededWorkerFixture();
	const contexts = mockContexts(true);
	let runs = 0;
	try {
		const beforeQualification = await service.repository.read();
		const unqualifiedContexts = mockContexts();
		const unqualified = new ModuleTaskWorkerService(
			f.root,
			undefined,
			unqualifiedContexts.contexts
		);
		await expect(unqualified.once('owner')).rejects.toMatchObject({ quotaRejected: false });
		expect(await service.repository.read()).toEqual(beforeQualification);
		expect(unqualifiedContexts.calls).toHaveLength(0);
		const worker = new ModuleTaskWorkerService(
			f.root,
			{
				run: async () => {
					runs++;
					return {
						provider: 'codex',
						model: 'gpt-6-luna',
						intelligence: 'max',
						text: 'Done',
						reportedModel: 'gpt-6-luna'
					};
				}
			},
			contexts.contexts
		);
		const commit = await f.git.run(['rev-parse', 'refs/harness/tasks']);
		const aborted = new AbortController();
		aborted.abort();
		await worker.once('owner', [], aborted.signal).catch(() => undefined);
		const preclaimUnchanged =
			(await f.git.run(['rev-parse', 'refs/harness/tasks'])) === commit &&
			(await service.show(input.id)).task.status === 'queued';
		const result = await worker.once('owner');
		if (result.status === 'idle') throw new Error('Expected context-failure result, received idle');
		const stored = (await service.show(input.id)).task;
		expect([
			preclaimUnchanged,
			result.status,
			stored.status,
			runs,
			contexts.calls.length,
			contexts.state.cleanups
		]).toEqual([true, 'failed', 'failed', 0, 1, 0]);
		expect(String(JSON.stringify(result.result))).not.toContain('private sentinel');
		expect(result.result?.usage).toBeUndefined();
	} finally {
		await f.dispose();
	}
});

test(
	'workspace preparation failure finalizes without a worktree or runner context',
	assertWorkspaceFailure
);
test(
	'approved claims reject stale or unrelated work before running a provider',
	assertApprovedWorkerScope
);
