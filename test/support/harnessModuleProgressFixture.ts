import { mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect } from 'vitest';
import type { ModuleTaskService } from '../../src/services/agents-providers/ModuleTaskService';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import type { moduleTaskFixture } from './moduleTaskFixture';

export async function verifyHarnessModuleProgress(
	fixture: Awaited<ReturnType<typeof moduleTaskFixture>>,
	service: ModuleTaskService,
	accepted: { commit: string; id: string }
) {
	const queue = (await service.repository.read()).data;
	const recorded = queue.tasks.find(({ status }) => status === 'accepted')!;
	await fixture.git.run(['update-ref', 'refs/remotes/origin/main', accepted.commit]);
	await expectModuleState(fixture.root, 'no-checks', 'in_progress');

	// The acceptance test above exercises the actual recorder; seed a retained check
	// receipt here to isolate how the progress endpoint interprets it.
	await service.repository.update((data) => {
		const task = data.tasks.find(({ id }) => id === recorded.id)!;
		task.reviews[0].evidence!.checks = 1;
	});
	await expectModuleState(fixture.root, 'merged', 'built');

	await fixture.git.run(['update-ref', 'refs/remotes/origin/main', recorded.sourceCommit]);
	await expectModuleState(fixture.root, 'unmerged', 'in_progress');
}

async function expectModuleState(root: string, label: string, state: string) {
	const directory = join(root, 'progress-fixture', label);
	await mkdir(directory, { recursive: true });
	await symlink(root, join(directory, 'harness'), 'dir');
	const database = new DatabaseSync(':memory:');
	try {
		const runtime = new TrackerNativeRuntimeService(database, {
			node: 'fixture',
			role: 'hub',
			projectPlanDirectory: directory
		});
		const response = await runtime.items.handle(
			new Request('http://fixture/progress?project=harness')
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			project: 'harness',
			plan: { state: 'available', modules: [{ id: 'service.orders', state }] }
		});
	} finally {
		database.close();
	}
}
