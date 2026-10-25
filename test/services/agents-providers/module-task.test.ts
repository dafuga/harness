import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';
import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { readFile } from 'node:fs/promises';
import { taskSelection } from '../../../src/services/agents-providers/module-task-service/taskPrompt';
import { observedTaskOperation } from '../../support/taskProfiles';
test('admission rejects missing contracts, unknown modules and mutable task identities', async () => {
	const f = await moduleTaskFixture();
	try {
		const service = new ModuleTaskService(f.root);
		await service.feature({
			id: 'checkout',
			goal: 'Reliable checkout',
			tldr: 'Build validated orders.'
		});
		const input = JSON.parse(await readFile(await f.input(), 'utf8'));
		await expect(service.add({ ...input, wantedContract: undefined })).rejects.toThrow(
			'wantedContract'
		);
		await expect(service.add({ ...input, module: 'service.missing' })).rejects.toThrow(
			'active and registered'
		);
		await observedTaskOperation(
			'service.agents-providers-module-task',
			'admit-committed-module-contract',
			() => service.add(input)
		);
		await expect(service.add(input)).rejects.toThrow('already exists');
		await expect(
			service.feature({ id: 'checkout', goal: 'Changed goal', tldr: 'Changed context' })
		).rejects.toThrow('immutable');
		expect((await service.show(input.id)).task.wantedContract).toEqual(input.wantedContract);
		expect(
			(await service.prompt(input.id)).startsWith(
				'Overall goal: Reliable checkout\nFeature TLDR: Build validated orders.\n'
			)
		).toBe(true);
	} finally {
		await f.dispose();
	}
});
test('retry preserves abandoned claims and refuses to steal an active owner', async () => {
	const f = await moduleTaskFixture();
	try {
		const service = new ModuleTaskService(f.root),
			owner = await service.repository.owner();
		await service.feature({
			id: 'checkout',
			goal: 'Reliable checkout',
			tldr: 'Build validated orders.'
		});
		await service.add(JSON.parse(await readFile(await f.input(), 'utf8')));
		const token = '733715ae-dd63-4896-b94b-58a51d693a58';
		await service.repository.update((q) => {
			q.tasks[0].status = 'running';
			q.tasks[0].claim = { worker: 'owner', token, startedAt: new Date().toISOString(), owner };
		});
		await expect(service.retry('orders-validation')).rejects.toThrow(
			'active, unknown or in another clone'
		);
		await service.repository.update((q) => {
			q.tasks[0].claim!.owner.startedAt = 'Earlier process with a reused PID';
		});
		await service.retry('orders-validation');
		const task = (await service.show('orders-validation')).task;
		expect(task.status).toBe('queued');
		expect(task.claim).toBeUndefined();
		expect(task.claimHistory[0].token).toBe(token);
	} finally {
		await f.dispose();
	}
});
test('auto owns model and intelligence, while exact model choices retain their effort', () => {
	expect(taskSelection({ model: 'auto' })).toEqual({
		provider: 'claude',
		model: 'claude-haiku-5-5',
		intelligence: 'medium'
	});
	expect(taskSelection({ model: 'gpt-6-luna', intelligence: 'max' })).toEqual({
		provider: 'codex',
		model: 'gpt-6-luna',
		intelligence: 'max'
	});
	expect(() => taskSelection({ model: 'auto', intelligence: 'high' })).toThrow('explicit model');
	expect(() => taskSelection({ model: 'claude-haiku-5-5', intelligence: 'ultra' })).toThrow(
		'does not support'
	);
});

test.each([
	['claude-haiku-5-5', 100, 0.00002, 0.00002],
	['claude-haiku-5-5', 100001, 0.0100101, 0.0500505],
	['gpt-6.1-sol', 100, 0.0004, 0.0004],
	['gpt-6-astra', 100, 0.002, 0.002],
	['unpriced-model', 100, null, null]
])(
	'API quotes use versioned rates and preserve unknown models (%s, %i input)',
	async (model, inputTokens, minimum, maximum) => {
		const f = await moduleTaskFixture();
		try {
			const service = new ModuleTaskService(f.root);
			await service.feature({
				id: 'checkout',
				goal: 'Reliable checkout',
				tldr: 'Build validated orders.'
			});
			await service.add(
				JSON.parse(
					await readFile(
						await f.input({
							model,
							provider: String(model).startsWith('gpt-') ? 'codex' : 'claude',
							intelligence: 'medium'
						}),
						'utf8'
					)
				)
			);
			const worker = new ModuleTaskWorkerService(f.root, {
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
			});
			await worker.once('owner');
			const quote = (await service.show('orders-validation')).task.result?.executions?.[0].apiCost;
			if (minimum === null)
				expect(quote).toMatchObject({ usd: null, minimumUsd: null, maximumUsd: null });
			else {
				expect(quote?.minimumUsd, 'known exact model pricing must be available').toBeCloseTo(
					Number(minimum),
					10
				);
				expect(quote?.maximumUsd).toBeCloseTo(Number(maximum), 10);
			}
			expect(quote).toHaveProperty('rateCard');
		} finally {
			await f.dispose();
		}
	}
);
