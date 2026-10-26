import { spawnSync } from 'node:child_process';
import { expect, vi } from 'vitest';
import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';
import { pendingTaskResult } from '../../../src/services/agents-providers/module-task-worker-service/taskClaim';
import { seededWorkerFixture } from './module-task-worker.test.fixtures';

function gitInput(root: string, args: string[], input: string) {
	const result = spawnSync('git', ['-C', root, ...args], { input, encoding: 'utf8' });
	if (result.status !== 0) throw new Error(result.stderr);
	return result.stdout.trim();
}

async function checkpoint(
	f: Awaited<ReturnType<typeof seededWorkerFixture>>['f'],
	names: string[]
) {
	const entries = await f.git.run(['ls-tree', f.source]);
	const additions = names.map((name) => {
		const blob = gitInput(f.root, ['hash-object', '-w', '--stdin'], `accepted ${name}\n`);
		return `100644 blob ${blob}\t${name}.txt`;
	});
	const tree = gitInput(f.root, ['mktree'], [entries.trim(), ...additions].join('\n') + '\n');
	return f.git.run(['commit-tree', tree, '-p', f.source, '-m', `synthetic ${names.join(' ')}`]);
}

async function seedDependencies(
	seeded: Awaited<ReturnType<typeof seededWorkerFixture>>,
	children: string[],
	repairCommit: string | undefined
) {
	const { f, service, input } = seeded;
	await service.repository.update((queue) => {
		const parent = queue.tasks.find((task) => task.id === input.id)!;
		parent.dependsOn = ['child-a', 'child-b'];
		parent.repairCommit = repairCommit;
		for (const [index, id] of parent.dependsOn.entries())
			queue.tasks.push({
				...structuredClone(parent),
				id,
				assignee: 'other-owner',
				status: 'accepted',
				dependsOn: [],
				result: {
					...pendingTaskResult(
						{ provider: 'codex', model: 'gpt-6-luna', intelligence: 'max' },
						f.root
					),
					checkpointCommit: children[index]
				}
			});
	});
}

async function dependencyWorkerFixture(repair: boolean) {
	const seeded = await seededWorkerFixture();
	const { f, service, input, contexts } = seeded;
	const children = [await checkpoint(f, ['child-a']), await checkpoint(f, ['child-b'])];
	const repairCommit = repair ? await checkpoint(f, ['repair']) : undefined;
	const resolved = await checkpoint(
		f,
		repair ? ['child-a', 'child-b', 'repair'] : ['child-a', 'child-b']
	);
	await seedDependencies(seeded, children, repairCommit);
	const before = (await service.show(input.id)).task;
	const dependencyBase = {
		resolve: vi.fn(async (_input: { sourceCommit: string; checkpoints: string[] }) => resolved)
	};
	const heads: string[] = [];
	const run = vi.fn(
		async (
			request: Parameters<
				NonNullable<ConstructorParameters<typeof ModuleTaskWorkerService>[1]>['run']
			>[0]
		) => {
			heads.push(await f.git.run(['-C', request.cwd, 'rev-parse', 'HEAD']));
			return {
				provider: request.provider,
				model: request.model,
				intelligence: request.intelligence,
				reportedModel: request.model,
				text: 'Synthetic completed work'
			};
		}
	);
	const worker = new ModuleTaskWorkerService(f.root, { run }, contexts.contexts, dependencyBase);
	return {
		...seeded,
		children,
		repairCommit,
		resolved,
		before,
		dependencyBase,
		heads,
		run,
		worker
	};
}

async function assertDependencySuccess(repair: boolean) {
	const s = await dependencyWorkerFixture(repair);
	try {
		const expected = [...s.children, ...(s.repairCommit ? [s.repairCommit] : [])];
		s.dependencyBase.resolve.mockImplementationOnce(async (request) => {
			expect(request).toEqual({ sourceCommit: s.before.sourceCommit, checkpoints: expected });
			expect((await s.service.show(s.input.id)).task).toMatchObject({
				status: 'running',
				claim: { worker: 'owner' }
			});
			expect(s.run).not.toHaveBeenCalled();
			await s.service.repository.update((queue) => {
				queue.tasks.find((task) => task.id === 'child-a')!.result!.checkpointCommit = s.f.source;
			});
			return s.resolved;
		});
		const result = await s.worker.once('owner');
		expect(s.dependencyBase.resolve).toHaveBeenCalledExactlyOnceWith({
			sourceCommit: s.before.sourceCommit,
			checkpoints: expected
		});
		expect(result.status).toBe('review');
		expect(s.heads).toEqual([s.resolved]);
		expect(s.contexts.calls[0]).toMatchObject({
			task: { sourceCommit: s.resolved },
			files: s.before.module.files
		});
		expect(s.run.mock.calls[0][0].prompt).toContain(s.resolved);
		for (const name of repair ? ['child-a', 'child-b', 'repair'] : ['child-a', 'child-b']) {
			expect(await s.f.git.run(['show', `${s.resolved}:${name}.txt`])).toBe(`accepted ${name}`);
		}
		const stored = (await s.service.show(s.input.id)).task;
		expect(stored).toMatchObject({
			sourceCommit: s.before.sourceCommit,
			contractHash: s.before.contractHash,
			module: s.before.module,
			dependsOn: s.before.dependsOn,
			repairCommit: s.repairCommit,
			claim: { worker: 'owner' },
			result: { sourceCommit: s.resolved }
		});
		expect(await s.f.git.run(['rev-parse', 'HEAD'])).toBe(s.f.source);
	} finally {
		await s.f.dispose();
	}
}

async function assertDependencyFailures() {
	for (const kind of [
		'missing',
		'unaccepted',
		'cross-feature',
		'missing-checkpoint',
		'invalid-checkpoint',
		'merge-error'
	]) {
		const s = await dependencyWorkerFixture(false);
		try {
			await s.service.repository.update((queue) => {
				const child = queue.tasks.find((task) => task.id === 'child-a')!;
				if (kind === 'missing') queue.tasks = queue.tasks.filter((task) => task.id !== child.id);
				if (kind === 'unaccepted') child.status = 'review';
				if (kind === 'cross-feature') child.feature = { ...child.feature, id: 'different-feature' };
				if (kind === 'missing-checkpoint') delete child.result!.checkpointCommit;
				if (kind === 'invalid-checkpoint') child.result!.checkpointCommit = 'f'.repeat(40);
			});
			if (kind === 'merge-error' || kind === 'invalid-checkpoint')
				s.dependencyBase.resolve.mockRejectedValue(
					new Error('private checkpoint failure sentinel')
				);
			const result = await s.worker.once('owner');
			expect(['idle', 'failed']).toContain(result.status);
			expect(s.run).not.toHaveBeenCalled();
			expect(s.contexts.calls).toHaveLength(0);
			const task = (await s.service.show(s.input.id)).task;
			expect(['queued', 'failed']).toContain(task.status);
			expect(task.result?.usage).toBeUndefined();
			expect(JSON.stringify(result)).not.toContain('private checkpoint failure sentinel');
			expect(task.sourceCommit).toBe(s.before.sourceCommit);
		} finally {
			await s.f.dispose();
		}
	}
}

export async function assertDependencyWorker() {
	await assertDependencySuccess(false);
	await assertDependencySuccess(true);
	await assertDependencyFailures();
}
