import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { observedTaskOperation } from '../../support/taskProfiles';
test('module filters and assignment claims select once, then preserve changes for review', async () => {
	const f = await moduleTaskFixture();
	try {
		const service = new ModuleTaskService(f.root);
		await service.feature({
			id: 'checkout',
			goal: 'Reliable checkout',
			tldr: 'Build validated orders.'
		});
		const input = JSON.parse(await readFile(await f.input({ assignee: 'owner' }), 'utf8'));
		await service.add(input);
		const worker = new ModuleTaskWorkerService(f.root, {
			run: async (input) => {
				await writeFile(join(input.cwd, 'src/orders.ts'), 'export const orders=2;');
				return {
					provider: input.provider,
					model: input.model,
					intelligence: input.intelligence,
					text: 'Implemented',
					reportedModel: input.model
				};
			}
		});
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
async function reviewFixture() {
	const f = await moduleTaskFixture();
	const service = new ModuleTaskService(f.root);
	await service.feature({
		id: 'checkout',
		goal: 'Reliable checkout',
		tldr: 'Build validated orders.'
	});
	await service.add(
		JSON.parse(await readFile(await f.input({ model: 'gpt-6-luna', intelligence: 'max' }), 'utf8'))
	);
	let count = 0;
	const worker = new ModuleTaskWorkerService(f.root, {
		run: async (input) => {
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
	});
	return { f, service, worker };
}
test('incomplete review commits a repair base, requeues once, and keeps prior work and contract', async () => {
	const { f, service, worker } = await reviewFixture();
	try {
		await worker.once('owner');
		const first = (await service.show('orders-validation')).task;
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
		expect(accepted.result?.executions?.[0]).toMatchObject({
			model: 'gpt-6-luna',
			intelligence: 'max',
			apiCost: { usd: 0.002, basis: 'cli-reported' }
		});
		expect(await f.git.run(['rev-parse', 'HEAD'])).toBe(f.source);
	} finally {
		await f.dispose();
	}
});
