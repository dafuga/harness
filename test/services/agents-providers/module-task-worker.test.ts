import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { verifiedSubmission, verifiedTaskBaseline } from '../../support/moduleTaskEvidence';
import { observedTaskOperation } from '../../support/taskProfiles';
import { seedTaskFrameFlag, hash } from '../../support/frameFlagFixture';
import { ModuleTaskRunnerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskRunnerAdapter';
import { LfsAdapter } from '../../../src/adapters/git-source-history/LfsAdapter';
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
		const flag = await seedTaskFrameFlag(f.root, f.source, 'service.orders');
		const other = await seedTaskFrameFlag(f.root, f.source, 'service.other');
		const linkedRoot = join(f.root, 'linked-owner');
		await f.git.run(['worktree', 'add', '--detach', linkedRoot, f.source]);
		const worker = new ModuleTaskWorkerService(linkedRoot, {
			run: async (input) => {
				const images = (input as typeof input & { images?: string[] }).images;
				expect(images, 'owning task receives the extracted frame image').toHaveLength(1);
				expect(hash(await readFile(images![0]))).toBe(flag.frame.sha256);
				expect(await new LfsAdapter(f.root).read(flag.frame.sha256)).toEqual(
					await readFile(images![0])
				);
				expect(input.prompt).toContain(flag.id);
				expect(input.prompt).toContain('Inspect this edge');
				expect(input.prompt).not.toContain(other.id);
				expect(
					dirname(input.cwd),
					'linked worker shares the task-worktree root from common Git'
				).toBe(join(await realpath(f.root), '.cache/harness/task-worktrees'));
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
		const outcomes = await observedTaskOperation(
			'service.agents-providers-module-task-worker',
			'exclusive-dispatch-with-synthetic-runner',
			() => Promise.all([worker.once('owner'), worker.once('owner')])
		);
		expect(outcomes.map((x) => x.status).sort()).toEqual(['idle', 'review']);
		expect((await service.show(input.id)).task.result?.changedFiles).toEqual(['src/orders.ts']);
	} finally {
		await f.dispose();
	}
});
async function reviewFixture() {
	const f = await moduleTaskFixture();
	const baseline = await verifiedTaskBaseline(f);
	const service = new ModuleTaskService(f.root);
	await service.feature({
		id: 'checkout',
		goal: 'Reliable checkout',
		tldr: 'Build validated orders.'
	});
	await service.add(
		JSON.parse(await readFile(await f.input({ model: 'gpt-6-luna', intelligence: 'max' }), 'utf8'))
	);
	let count = 0;
	const worker = new ModuleTaskWorkerService(f.root, {
		run: async (input) => {
			if (count++)
				expect(await readFile(join(input.cwd, 'src/orders.ts'), 'utf8')).toContain('orders = 2');
			await writeFile(
				join(input.cwd, 'src/orders.ts'),
				// The repair keeps the frozen size budget, so its checkpoint can verify clean.
				`export const orders = ${count > 1 ? 3 : 2};\n`
			);
			return {
				provider: input.provider,
				model: input.model,
				intelligence: input.intelligence,
				reportedModel: input.model,
				text: 'Done',
				usage: {
					inputTokens: 100,
					outputTokens: 20,
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					cacheWriteLongTokens: 0,
					reportedCostUsd: 0.002
				}
			};
		}
	});
	return { f, service, worker, baseline };
}
test('incomplete review commits a repair base, requeues once, and keeps prior work and contract', async () => {
	const { f, service, worker, baseline } = await reviewFixture();
	try {
		await worker.once('owner');
		const first = (await service.show('orders-validation')).task;
		const review = {
			attempt: first.claim!.token,
			verdict: 'incomplete',
			reviewer: 'tester',
			cause: 'verification',
			feedback: 'Keep the implementation and address review feedback.'
		};
		await service.review(first.id, review);
		expect(await service.review(first.id, review)).toMatchObject({ replayed: true });
		const conflicting = { attempt: review.attempt, verdict: 'accepted', evidence: 'HEAD' };
		await expect(service.review(first.id, conflicting)).rejects.toThrow(
			'already reviewed as incomplete'
		);
		const queued = (await service.show(first.id)).task;
		expect(queued).toMatchObject({
			status: 'queued',
			contractHash: first.contractHash,
			reviews: [{ verdict: 'incomplete', cause: 'verification', attempt: first.claim!.token }]
		});
		expect(await f.git.run(['show', `${queued.repairCommit}:src/orders.ts`])).toContain(
			'orders = 2'
		);
		await worker.once('owner');
		const evidence = await acceptVerified(f, service, first.id);
		const accepted = (await service.show(first.id)).task;
		expect(accepted.status).toBe('accepted');
		expect(accepted.reviews).toHaveLength(2);
		expect(accepted.reviews[1].evidence).toEqual({
			commit: evidence.commit,
			record: evidence.id,
			scope: 'full',
			checks: expect.any(Number)
		});
		expect(accepted.attempts).toHaveLength(1);
		expect(accepted.attempts[0].changedLines).toBe(2);
		expect(accepted.result?.changedLines).toBe(2);
		expect(accepted.result?.executions?.[0]).toMatchObject({
			model: 'gpt-6-luna',
			intelligence: 'max',
			apiCost: { usd: 0.002, basis: 'cli-reported' }
		});
		expect(await f.git.run(['rev-parse', 'HEAD'])).toBe(baseline);
	} finally {
		await f.dispose();
	}
}, 30000);

async function acceptVerified(
	f: Awaited<ReturnType<typeof moduleTaskFixture>>,
	service: ModuleTaskService,
	id: string
) {
	const second = (await service.show(id)).task;
	const accept = { attempt: second.claim!.token, verdict: 'accepted', reviewer: 'tester' };
	await expect(service.review(id, accept)).rejects.toThrow('requires --evidence');
	const evidence = await verifiedSubmission(f, {
		sourceCommit: second.sourceCommit,
		result: { checkpointCommit: second.result!.checkpointCommit! }
	});
	await service.review(id, { ...accept, evidence: evidence.commit });
	return evidence;
}

test.each(['repaired', 'exhausted'] as const)(
	'declared checks retain each round and resume the same provider session (%s)',
	async (outcome) => {
		const f = await moduleTaskFixture();
		try {
			const service = new ModuleTaskService(f.root);
			await f.feature();
			const check = {
				argv: [
					process.execPath,
					'--eval',
					"const file = await Bun.file('src/orders.ts').text(); if (!file.includes('orders = 3')) { console.error('Expected order count 3'); process.exit(1); }"
				]
			};
			await service.add(JSON.parse(await readFile(await f.input({ check }), 'utf8')));
			const { runner, calls, sessionId } = checkedTaskRunner(outcome === 'repaired');
			expect(await new ModuleTaskWorkerService(f.root, runner).once('owner')).toMatchObject({
				status: 'blocked'
			});
			expect(calls).toHaveLength(0);
			const worker = new ModuleTaskWorkerService(f.root, runner, undefined, true);
			const result = await observedTaskOperation(
				'service.agents-providers-module-task-worker',
				'declared-check-with-synthetic-provider',
				() => worker.once('owner')
			);
			const shown = (await service.show('orders-validation')).task;
			const repaired = outcome === 'repaired';
			expect(result.status).toBe(repaired ? 'review' : 'failed');
			expect(shown.result?.checkRounds).toMatchObject(
				repaired
					? [
							{ status: 'failed', exitCode: 1 },
							{ status: 'passed', exitCode: 0 }
						]
					: Array.from({ length: 3 }, () => ({ status: 'failed', exitCode: 1 }))
			);
			expect(shown.result?.executions).toHaveLength(repaired ? 2 : 3);
			expect(shown.result?.checkpointCommit).toMatch(/^[a-f0-9]{40}$/);
			expect(calls[0].command).not.toContain('resume');
			for (const call of calls.slice(1)) {
				expect(call.command).toContain('resume');
				expect(call.command).toContain(sessionId);
				expect(call.prompt).toContain('Expected order count 3');
				expect(call.cwd).toBe(calls[0].cwd);
			}
		} finally {
			await f.dispose();
		}
	},
	30000
);

function checkedTaskRunner(repair: boolean) {
	const sessionId = '4de9edbc-d14a-4e0a-84aa-e95d62c17895';
	const calls: { command: string[]; prompt: string; cwd: string }[] = [];
	const runner = new ModuleTaskRunnerAdapter(async (command, { prompt, cwd }) => {
		calls.push({ command, prompt, cwd });
		const orders = repair && calls.length > 1 ? 3 : 2;
		await writeFile(join(cwd, 'src/orders.ts'), `export const orders = ${orders};\n`);
		return {
			code: 0,
			stdout: [
				JSON.stringify({ type: 'thread.started', thread_id: sessionId }),
				JSON.stringify({ type: 'turn.completed', model: 'gpt-6-luna' })
			].join('\n')
		};
	});
	return { runner, calls, sessionId };
}
