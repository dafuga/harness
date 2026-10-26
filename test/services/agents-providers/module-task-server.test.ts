import { describe, expect, test, vi } from 'vitest';
import {
	admissionTrace,
	contract,
	feature,
	invoke,
	makeFixture,
	manifest,
	nextCommit,
	outcome,
	plan,
	rejectBeforeUpdate,
	root,
	sourceCommit,
	task
} from './fixtures/module-task-server.fixtures';

describe('ModuleTaskServerService.submit', () => {
	test('validates all entries, then admits the full scope in one selected-source update', async () => {
		const f = makeFixture(),
			one = Object.assign(task('task-one'), {
				verificationFiles: ['test/task-one.test.ts'],
				assignee: 'worker-one',
				model: 'gpt-6-luna',
				provider: 'codex',
				intelligence: 'max'
			});
		const result = await f.service.submit(plan([one, task('task-two', 'service.beta')]));
		expect(result).toEqual({ created: ['task-one', 'task-two'], reused: [], commit: nextCommit });
		expect(f.collaborators.openTree).toHaveBeenCalledWith(root, 'HEAD');
		expect(f.collaborators.registry.read).toHaveBeenCalledWith(f.tree);
		expect(f.collaborators.requireMetadata.mock.calls).toEqual([
			[root, sourceCommit, 'service.alpha'],
			[root, sourceCommit, 'service.beta']
		]);
		expect(f.collaborators.repository.update).toHaveBeenCalledTimes(1);
		expect(f.collaborators.repository.update.mock.calls[0][1]).toBe(sourceCommit);
		expect(admissionTrace(f)).toEqual({
			grants: [
				['task-one', 'service.alpha', f.tree],
				['task-two', 'service.beta', f.tree]
			],
			validated: [
				[root, ['src/alpha.ts']],
				[root, ['src/beta.ts']]
			],
			beforeUpdate: true
		});
		const saved = f.queue();
		expect(saved.features).toEqual([feature]);
		expect(saved.tasks).toMatchObject([
			{
				id: 'task-one',
				role: 'implementation',
				assignee: 'worker-one',
				model: 'gpt-6-luna',
				provider: 'codex',
				intelligence: 'max',
				module: { files: ['src/alpha.ts'] }
			},
			{ id: 'task-two', role: 'implementation', module: { files: ['src/beta.ts'] } }
		]);
	});

	test('reuses equivalent definitions and rejects conflicting task or feature ids without mutation', async () => {
		const f = makeFixture(),
			desired = plan([task('task-one')]);
		await f.service.submit(desired);
		expect(await f.service.submit(desired)).toMatchObject({
			created: [],
			reused: ['task-one'],
			commit: nextCommit
		});
		const before = f.queue();
		for (const conflict of [
			plan([task('task-one', 'service.alpha', { title: 'Conflict' })]),
			plan([task('task-one', 'service.alpha', { role: 'verification' })]),
			plan([task('task-one', 'service.alpha', { assignedFiles: ['src/alpha.alternate.ts'] })]),
			plan([task('task-two')], { ...feature, goal: 'Conflict' })
		])
			await expect(f.service.submit(conflict)).rejects.toThrow();
		expect(f.queue()).toEqual(before);
		expect(f.commit()).toBe(nextCommit);
	});

	test('rejects malformed plans, modules, metadata, goals, contracts, model settings and scopes before update', async () => {
		const alpha = manifest('service.alpha');
		const cases: Array<[unknown, Parameters<typeof makeFixture>[0]]> = [
			[plan([task('task-one'), task('task-one')]), {}],
			[plan([task('task-one', 'service.alpha', { feature: 'other-feature' })]), {}],
			[
				plan([task('valid-first'), task('missing-second', 'service.missing')]),
				{ manifests: [alpha] }
			],
			[plan([task('task-one')]), { manifests: [{ ...alpha, status: 'retired' }] }],
			[plan([task('task-one')]), { errors: ['invalid manifest'] }],
			[plan([task('task-one')]), { manifests: [{ ...alpha, owns: { source: [] } }] }],
			[
				plan([task('task-one')]),
				{ manifests: [{ ...alpha, contract: { ...alpha.contract, outputs: [] } }] }
			],
			[
				plan([task('task-one', 'service.alpha', { moduleGoal: undefined })]),
				{ manifests: [{ ...alpha, responsibilityOrigin: 'derived' }] }
			],
			[
				plan([task('task-one', 'service.alpha', { wantedContract: { ...contract, outputs: [] } })]),
				{}
			],
			[plan([task('task-one', 'service.alpha', { model: 'auto', provider: 'codex' })]), {}],
			[
				plan([task('task-one', 'service.alpha', { verificationFiles: ['../outside.test.ts'] })]),
				{}
			],
			[plan([task('task-one')]), { metadataFailure: new Error('incomplete metadata') }]
		];
		for (const [value, options] of cases) await rejectBeforeUpdate(value, options);
	});

	test('preflights every grant before mutation or worker launch', async () => {
		const f = makeFixture();
		f.collaborators.validateGrant
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('unsafe second grant'));
		const before = f.queue();
		await expect(
			f.service.run(plan([task('task-one'), task('task-two', 'service.beta')]), {
				worker: 'worker-one',
				modules: ['service.alpha', 'service.beta'],
				once: true,
				signal: new AbortController().signal
			})
		).rejects.toThrow('unsafe second grant');
		expect(f.collaborators.grantFiles).toHaveBeenCalledTimes(2);
		expect(f.collaborators.validateGrant).toHaveBeenCalledTimes(2);
		expect(f.collaborators.repository.update).not.toHaveBeenCalled();
		expect(f.collaborators.worker.once).not.toHaveBeenCalled();
		expect(f.queue()).toEqual(before);
	});
});

describe('ModuleTaskServerService.run', () => {
	test.each(['review', 'failed'] as const)(
		'returns the actual %s outcome unchanged',
		async (status) => {
			const f = makeFixture(),
				actual = outcome(status),
				signal = new AbortController().signal;
			f.collaborators.worker.once.mockResolvedValue(actual);
			const result = await invoke(f, {
				worker: 'worker-one',
				modules: ['service.alpha'],
				once: true,
				signal
			});
			expect(result).toEqual({
				submission: { created: ['task-one'], reused: [], commit: nextCommit },
				results: [actual]
			});
			expect(f.collaborators.worker.once.mock.calls[0]).toEqual([
				'worker-one',
				['service.alpha'],
				signal
			]);
			expect(f.queue().tasks[0].status).toBe('queued');
		}
	);

	test('keeps idle distinct and rejects invalid or pre-aborted inputs before submission', async () => {
		const idle = makeFixture(),
			signal = new AbortController().signal;
		await expect(
			invoke(idle, { worker: 'worker-one', modules: [], once: true, signal })
		).resolves.toMatchObject({ results: [{ status: 'idle' }] });
		const cases: Array<[string, string[], boolean]> = [
			['Bad Worker', [], false],
			['worker-one', ['bad module'], false],
			['worker-one', [], true]
		];
		for (const [worker, modules, aborted] of cases) {
			const f = makeFixture(),
				controller = new AbortController();
			if (aborted) controller.abort();
			await expect(
				invoke(f, { worker, modules, once: true, signal: aborted ? controller.signal : signal })
			).rejects.toThrow();
			expect(f.collaborators.repository.update).not.toHaveBeenCalled();
			expect(f.collaborators.worker.once).not.toHaveBeenCalled();
		}
	});

	test('watch polls and awaits the active worker before propagating cancellation', async () => {
		const f = makeFixture();
		let finish!: (value: unknown) => void;
		const active = new Promise<unknown>((resolve) => (finish = resolve));
		f.collaborators.worker.once
			.mockResolvedValueOnce({ status: 'idle' })
			.mockReturnValueOnce(active);
		const controller = new AbortController(),
			pending = invoke(f, {
				worker: 'worker-one',
				modules: [],
				once: false,
				signal: controller.signal
			});
		let settled = false;
		void pending.then(
			() => (settled = true),
			() => (settled = true)
		);
		await vi.waitFor(() => expect(f.collaborators.worker.once).toHaveBeenCalledTimes(2));
		controller.abort();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(settled).toBe(false);
		finish({ status: 'idle' });
		await expect(pending).rejects.toHaveProperty('name', 'AbortError');
		expect(f.collaborators.worker.once).toHaveBeenCalledTimes(2);
	});
});
