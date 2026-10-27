import { assertPersistedDependencies } from './module-task-dependency.test.fixtures';
import {
	assertSafeTaskAssignment,
	expectSchemaGrants,
	quotedWorker
} from './module-task.test.fixtures';
import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { ModuleTaskServerService } from '../../../src/services/agents-providers/ModuleTaskServerService';
import type { ComponentManifest } from '../../../src/core/development-tooling/unitTypes';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { readFile } from 'node:fs/promises';
import { taskSelection } from '../../../src/services/agents-providers/module-task-service/taskPrompt';
import { observedTaskOperation } from '../../support/taskProfiles';
import { ZodError } from 'zod';
import { isolateAnalyticsSync } from './module-task-worker.test.fixtures';
isolateAnalyticsSync();
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
			() => assertPersistedDependencies(service, input)
		);
		await expect(service.add(input)).rejects.toThrow('already exists');
		await expect(
			service.feature({ id: 'checkout', goal: 'Changed goal', tldr: 'Changed context' })
		).rejects.toThrow('immutable');
		expect((await service.show(input.id)).task.wantedContract).toEqual(input.wantedContract);
		const moduleResponsibility = 'Keep the exact committed module responsibility in task context.';
		const module = {
			id: 'service.contract-source',
			responsibility: moduleResponsibility,
			responsibilityOrigin: 'declared',
			status: 'active',
			owns: { source: ['src/orders.ts'], symbols: [] },
			contract: { inputs: [], outputs: [{ name: 'result', type: 'string' }], errors: [] }
		} as unknown as ComponentManifest;
		const serverInput = {
			...input,
			id: 'server-admission-responsibility',
			feature: 'server-admission',
			module: module.id
		};
		delete serverInput.moduleGoal;
		const server = new ModuleTaskServerService(f.root, {
			registry: { read: async () => ({ manifests: [module], errors: [] }) },
			requireMetadata: async () => undefined,
			grantFiles: async () => module.owns.source,
			validateGrant: async () => undefined
		});
		await server.submit({
			feature: {
				id: 'server-admission',
				goal: 'Admit a task with its committed module goal.',
				tldr: 'Retain module responsibility before worker dispatch.'
			},
			tasks: [serverInput]
		});
		const admitted = (await service.show(serverInput.id)).task;
		expect(admitted.moduleGoal).toBe(moduleResponsibility);
		expect(admitted.module.goal).toBe(moduleResponsibility);
		expect(
			(await service.prompt(input.id)).startsWith(
				'Overall goal: Reliable checkout\nFeature TLDR: Build validated orders.\n'
			)
		).toBe(true);
		expect(await service.prompt(input.id)).toContain('Do not update personal or agent memory.');
		expect(await service.prompt(input.id)).toContain(
			'Use exactly these five contract-driven test forms'
		);
	} finally {
		await f.dispose();
	}
});
test('assign preserves untouched grants and rejects plan-bound or previously used tasks', async () => {
	const f = await moduleTaskFixture();
	try {
		const service = new ModuleTaskService(f.root);
		await service.feature({
			id: 'checkout',
			goal: 'Reliable checkout',
			tldr: 'Build validated orders.'
		});
		const input = JSON.parse(await readFile(await f.input(), 'utf8'));
		await service.add(input);
		await assertSafeTaskAssignment(service, f.root, input);
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
			const worker = quotedWorker(f.root, inputTokens);
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

test('assignment schemas preserve exact grants and reject unsafe inputs without queue mutation', async () => {
	const f = await moduleTaskFixture();
	try {
		const service = new ModuleTaskService(f.root);
		await service.feature({
			id: 'checkout',
			goal: 'Reliable checkout',
			tldr: 'Build validated orders.'
		});
		const input = JSON.parse(await readFile(await f.input(), 'utf8'));
		const add = (fields: Record<string, unknown>) => service.add({ ...input, ...fields });
		const show = async (id: string) =>
			(await service.show(id)).task as unknown as Record<string, unknown>;
		expectSchemaGrants(input);
		await add({ id: 'legacy-grant' });
		await service.repository.update((queue) => {
			const legacy = queue.tasks[0] as unknown as Record<string, unknown>;
			delete legacy.role;
			delete legacy.assignedFiles;
		});
		const legacy = await show('legacy-grant');
		expect(legacy.role).toBe('implementation');
		expect(legacy.assignedFiles).toBeUndefined();
		const before = await service.repository.read();
		const paths = (
			'|../source.ts|/tmp/source.ts|C:\\source.ts|src\\source.ts|./source.ts|src/./source.ts|' +
			'src/../source.ts|src/bad\nname.ts|src/bad\u0000name.ts|.git/config|src/.GiT/config|' +
			'src/*.ts|src/file?.ts|src/|'
		).split('|');
		const invalidInputs: Record<string, unknown>[] = [
			...paths.map((path) => ({ assignedFiles: [path] })),
			{ assignedFiles: Array.from({ length: 65 }, (_, i) => 'src/file-' + i + '.ts') },
			{ assignedFiles: ['src/one.ts', 'src/one.ts'] },
			{ role: 'worker' },
			{ unexpectedField: true },
			{ verificationFiles: ['src/unassigned.ts'] }
		];
		for (const fields of invalidInputs) {
			let failure: unknown;
			try {
				await add(fields);
			} catch (error) {
				failure = error;
			}
			expect(failure).toBeInstanceOf(ZodError);
			expect(await service.repository.read()).toEqual(before);
		}
	} finally {
		await f.dispose();
	}
});
