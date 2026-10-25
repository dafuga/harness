import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskRepository } from '../../../src/repositories/agents-providers/ModuleTaskRepository';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { observedTaskOperation } from '../../support/taskProfiles';
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
	} finally {
		await f.dispose();
	}
});
