import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskRepository } from '../../../src/repositories/agents-providers/ModuleTaskRepository';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { observedTaskOperation } from '../../support/taskProfiles';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { claimedTask } from '../../../src/services/agents-providers/module-task-worker-service/taskClaim';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { stableJson } from '../../../src/utils/development-tooling/stableJson';
import type { TaskFeature } from '../../../src/repositories/agents-providers/ModuleTaskRepository.types';
test('queue compare-and-swap retains simultaneous writers and commits without touching source HEAD', async () => {
	const f = await moduleTaskFixture();
	try {
		const repository = new ModuleTaskRepository(f.root);
		await observedTaskOperation(
			'repository.agents-providers-module-task',
			'six-concurrent-git-queue-transactions',
			() =>
				Promise.all(
					Array.from({ length: 6 }, (_, i) =>
						repository.update((q) =>
							q.features.push({
								id: `feature-${i}`,
								goal: 'Build checkout',
								tldr: 'Shared context'
							})
						)
					)
				)
		);
		const snapshot = await repository.read();
		expect(snapshot.data.features).toHaveLength(6);
		expect(
			JSON.parse(await f.git.run(['show', `${snapshot.commit}:queue.json`])).features
		).toHaveLength(6);
		expect(await f.git.run(['rev-parse', 'HEAD'])).toBe(f.source);
		await preserveExtendedTasks(f, repository);
		await observeCallbackInputs(repository);
	} finally {
		await f.dispose();
	}
});

async function preserveExtendedTasks(
	f: Awaited<ReturnType<typeof moduleTaskFixture>>,
	repository: ModuleTaskRepository
) {
	await f.feature();
	const service = new ModuleTaskService(f.root);
	await service.add(JSON.parse(await readFile(await f.input(), 'utf8')));
	const metadata = {
		role: 'verification',
		assignedFiles: ['src/orders.ts'],
		dependsOn: ['source-task']
	};
	await repository.update((queue) => Object.assign(queue.tasks[0], metadata));
	const current = await repository.read();
	const foreign = JSON.parse(await f.git.run(['show', `${current.commit}:queue.json`]));
	const example = JSON.parse(
		'{"__proto__":{"opaque":"keep"},"constructor":{"kind":"data"},"prototype":[1]}'
	);
	foreign.tasks[0].wantedContract.inputs.push({
		name: 'payload',
		type: 'json',
		examples: [example]
	});
	foreign.tasks[0].contractHash = createHash('sha256')
		.update(stableJson(foreign.tasks[0].wantedContract))
		.digest('hex');
	const blob = await f.git.run(['hash-object', '-w', '--stdin'], {
		input: JSON.stringify(foreign)
	});
	const tree = await f.git.run(['mktree'], { input: `100644 blob ${blob}\tqueue.json\n` });
	const commit = await f.git.run(['commit-tree', tree, '-p', current.commit!], {
		input: 'chore: simulate newer queue writer\n'
	});
	await f.git.run(['update-ref', repository.ref, commit, current.commit!]);
	const loaded = await repository.read();
	expect(
		Object.hasOwn(loaded.data.tasks[0].wantedContract.inputs[0].examples![0]!, '__proto__'),
		'opaque contract example survives schema reading'
	).toBe(true);
	await repository.update((queue) =>
		queue.features.push({ id: 'later', goal: 'Preserve stored tasks', tldr: 'Keep newer metadata' })
	);
	const retained = await repository.read();
	expect(retained.data.tasks[0]).toMatchObject(metadata);
	expect(retained.data.tasks[0].wantedContract).toEqual(foreign.tasks[0].wantedContract);
	expect(service.prepare(retained.data.tasks[0], retained.commit!).prompt).toContain('"__proto__"');
	const wire = JSON.parse(await f.git.run(['show', `${retained.commit}:queue.json`]));
	expect(wire.tasks[0].wantedContract).toEqual(foreign.tasks[0].wantedContract);
	const owner = { workspace: randomUUID(), pid: process.pid, startedAt: 'fixture' };
	for (const extra of [
		{ role: 'verification' },
		{ assignedFiles: ['src/orders.ts'] },
		{ dependsOn: ['source-task'] }
	]) {
		const base = JSON.parse(JSON.stringify(retained.data));
		for (const key of ['role', 'assignedFiles', 'dependsOn']) delete base.tasks[0][key];
		Object.assign(base.tasks[0], extra);
		expect(claimedTask(base, 'owner', ['service.orders'], owner)).toBeNull();
	}
}

async function observeCallbackInputs(repository: ModuleTaskRepository) {
	const calls = { getters: 0, iterators: 0, species: 0 };
	class Features extends Array<TaskFeature> {
		static get [Symbol.species]() {
			calls.species++;
			return Array;
		}
		override [Symbol.iterator]() {
			calls.iterators++;
			return super[Symbol.iterator]();
		}
	}
	await repository.update((queue) => {
		const list = new Features();
		list.push(...queue.features, {
			id: 'callback-probe',
			get goal() {
				calls.getters++;
				return 'Goal';
			},
			tldr: 'Context'
		});
		queue.features = list;
	});
	expect(calls).toEqual({ getters: 1, iterators: 0, species: 0 });
}
