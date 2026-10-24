import { expect, test } from 'vitest';
import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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
		const outcomes = await Promise.all([worker.once('owner'), worker.once('owner')]);
		expect(outcomes.map((x) => x.status).sort()).toEqual(['idle', 'review']);
		expect((await service.show(input.id)).task.result?.changedFiles).toEqual(['src/orders.ts']);
	} finally {
		await f.dispose();
	}
});
