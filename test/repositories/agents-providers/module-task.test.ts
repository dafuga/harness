import { expect, test } from 'vitest';
import { ModuleTaskRepository } from '../../../src/repositories/agents-providers/ModuleTaskRepository';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
test('queue compare-and-swap retains simultaneous writers and commits without touching source HEAD', async () => {
	const f = await moduleTaskFixture();
	try {
		const repository = new ModuleTaskRepository(f.root);
		await Promise.all(
			Array.from({ length: 6 }, (_, i) =>
				repository.update((q) =>
					q.features.push({ id: `feature-${i}`, goal: 'Build checkout', tldr: 'Shared context' })
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
