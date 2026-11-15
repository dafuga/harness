import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskRepository } from '../../../src/repositories/agents-providers/ModuleTaskRepository';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { observedTaskOperation } from '../../support/taskProfiles';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { claimedTask } from '../../../src/services/agents-providers/module-task-worker-service/taskClaim';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
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
		await f.feature();
		await new ModuleTaskService(f.root).add(JSON.parse(await readFile(await f.input(), 'utf8')));
		const metadata = {
			role: 'verification',
			assignedFiles: ['src/orders.ts'],
			dependsOn: ['source-task']
		};
		await repository.update((queue) => Object.assign(queue.tasks[0], metadata));
		await repository.update((queue) =>
			queue.features.push({
				id: 'later',
				goal: 'Preserve stored tasks',
				tldr: 'Keep newer metadata'
			})
		);
		const retained = await repository.read();
		expect(retained.data.tasks[0]).toMatchObject(metadata);
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
	} finally {
		await f.dispose();
	}
});
