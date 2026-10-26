import { expect, test, vi } from 'vitest';
import { approvedPlan, feature, makeFixture } from './fixtures/module-task-server.fixtures';
import type { ApprovedTaskScope } from '../../../src/helpers/agents-providers/moduleTaskApprovedSubmission.types';

test('approved dispatch verifies the plan and limits parallel workers to its exact scope', async () => {
	const approved = approvedPlan(),
		f = makeFixture({ approved });
	const request = { feature: feature.id, expectedDigest: approved.digest };
	const controller = new AbortController();
	let active = 0,
		peak = 0;
	let release!: () => void;
	const gate = new Promise<void>((resolve) => (release = resolve));
	const onceApproved = vi.fn(async () => {
		active++;
		peak = Math.max(peak, active);
		await gate;
		active--;
		return { status: 'idle' as const };
	});
	f.collaborators.worker.onceApproved = onceApproved;
	expect(typeof f.service.runApproved).toBe('function');
	const run = f.service.runApproved(request, {
		worker: 'worker-one',
		parallelism: 2,
		signal: controller.signal
	});
	await vi.waitFor(() => expect(onceApproved).toHaveBeenCalledTimes(2));
	expect(peak).toBe(2);
	expect(f.collaborators.plans.approved).toHaveBeenCalledTimes(2);
	expect(f.collaborators.worker.once).not.toHaveBeenCalled();
	for (const [worker, scope, signal] of onceApproved.mock.calls as unknown as Array<
		[string, ApprovedTaskScope, AbortSignal]
	>) {
		expect(worker).toBe('worker-one');
		expect(signal).toBe(controller.signal);
		expect(scope.plan).toEqual(approved);
		expect(scope.feature).toEqual(feature);
		expect(scope.records.map((record: { id: string }) => record.id)).toEqual([
			'task-one',
			'task-two'
		]);
	}
	release();
	expect(await run).toMatchObject({
		submission: { created: ['task-one', 'task-two'], reused: [] },
		results: [{ status: 'idle' }, { status: 'idle' }]
	});
});

test('approved dispatch rejects unsafe requests before launching any worker', async () => {
	const approved = approvedPlan(),
		request = { feature: feature.id, expectedDigest: approved.digest };
	for (const mode of ['missing', 'stale', 'cancelled', 'parallelism', 'readiness'] as const) {
		const f = makeFixture(mode === 'missing' ? {} : { approved });
		const onceApproved = vi.fn(async () => ({ status: 'idle' as const }));
		f.collaborators.worker.onceApproved = onceApproved;
		const controller = new AbortController();
		if (mode === 'cancelled') controller.abort();
		if (mode === 'readiness')
			f.collaborators.plans.approved
				.mockResolvedValueOnce(approved)
				.mockRejectedValueOnce(new Error('stale readiness'));
		const input = mode === 'stale' ? { ...request, expectedDigest: 'd'.repeat(64) } : request;
		await expect(
			f.service.runApproved(input, {
				worker: 'worker-one',
				parallelism: mode === 'parallelism' ? 0 : 2,
				signal: controller.signal
			})
		).rejects.toThrow();
		expect(onceApproved).not.toHaveBeenCalled();
	}
});
