import { expect } from 'vitest';
import type { ModuleTaskQueue } from '../../../../src/repositories/agents-providers/ModuleTaskRepository.types';
import {
	contract,
	feature,
	makeFixture,
	manifest,
	nextCommit,
	sourceCommit,
	task
} from './module-task-server.fixtures';
export const approvedPlan = () => ({
	feature: feature.id,
	goal: feature.goal,
	tldr: feature.tldr,
	sourceCommit,
	revision: 1,
	pages: [],
	changes: ['service.alpha', 'service.beta'].map((unit) => ({
		unit,
		kind: 'modify',
		wantedContract: contract,
		assignedFiles: [`src/${unit.split('.').at(-1)}.ts`]
	})),
	tasks: [task('task-one'), task('task-two', 'service.beta', { dependsOn: ['task-one'] })],
	digest: 'c'.repeat(64),
	approval: { digest: 'c'.repeat(64), reviewer: 'reviewer', approvedAt: '2026-10-26T12:00:00.000Z' }
});
export const checkApprovedSubmission = async () => {
	const approved = approvedPlan(),
		f = makeFixture({ approved });
	const request = { feature: feature.id, expectedDigest: approved.digest };
	const ids = ['task-one', 'task-two'],
		c = f.collaborators;
	const created = { created: ids, reused: [], commit: nextCommit };
	const reused = { created: [], reused: ids, commit: nextCommit };
	expect(await f.service.submitApproved(request)).toEqual(created);
	expect(f.collaborators.plans.approved).toHaveBeenCalledWith(request);
	expect(c.plans.approved.mock.invocationCallOrder[0]).toBeLessThan(
		c.repository.update.mock.invocationCallOrder[0]
	);
	expect(f.queue().tasks.map((item) => item.id)).toEqual(['task-one', 'task-two']);
	expect(f.queue().tasks[1]).toMatchObject({ dependsOn: ['task-one'], wantedContract: contract });
	expect(f.collaborators.worker.once).not.toHaveBeenCalled();
	const before = f.queue();
	expect(await f.service.submitApproved(request)).toEqual(reused);
	expect(f.queue()).toEqual(before);
};
export const checkApprovedRejections = async () => {
	const approved = approvedPlan(),
		request = { feature: feature.id, expectedDigest: approved.digest };
	for (const race of [
		(queue: ModuleTaskQueue) => (queue.plans = []),
		(queue: ModuleTaskQueue) => delete queue.plans![0].approval,
		(queue: ModuleTaskQueue) => (queue.plans![0].digest = 'd'.repeat(64)),
		(queue: ModuleTaskQueue) => (queue.plans![0].tasks[1].instructions = 'Changed'),
		(queue: ModuleTaskQueue) => (queue.plans![0].approval!.reviewer = 'Changed')
	]) {
		const f = makeFixture({ approved, race });
		await expect(f.service.submitApproved(request)).rejects.toThrow();
		expect(f.queue().tasks).toEqual([]);
		expect(f.queue().features).toEqual([]);
		expect(f.commit()).toBeUndefined();
	}
	for (const options of [
		{},
		{ approved, metadataFailure: new Error('Missing metadata') },
		{ approved, manifests: [manifest('service.alpha')] }
	]) {
		const f = makeFixture(options),
			before = f.queue();
		await expect(f.service.submitApproved(request)).rejects.toThrow();
		expect(f.queue()).toEqual(before);
		expect(f.collaborators.repository.update).not.toHaveBeenCalled();
	}
	const f = makeFixture({ approved });
	const stale = { ...request, expectedDigest: 'd'.repeat(64) };
	await expect(f.service.submitApproved(stale)).rejects.toThrow();
	expect(f.queue().tasks).toEqual([]);
};
