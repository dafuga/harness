import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { addLoopStep, completeLoopStep, createLoop } from '../../src/cli/program/manageLoop';
import { TaskCompletionService } from '../../src/services/verification-evidence/TaskCompletionService';
import { profilePlanningCompletion, profilePlanningLoop } from '../support/completionProfiles';
import { completeProposal, taskAuditRepo } from '../support/taskAuditRepo';

test('planning audits validate the committed proposal without implementing or profiling code', async () => {
	const repo = await taskAuditRepo();
	try {
		const service = new TaskCompletionService(repo.root);
		const before = await repo.git.run(['rev-parse', 'HEAD']);
		const audit = await service.check({
			kind: 'planning',
			goal: 'Plan catalog search',
			plan: 'plan.md'
		});
		expect(audit.passed, JSON.stringify(audit.checks)).toBe(true);
		expect(audit.commit).toBe(before);
		expect(audit.checks.some((check) => check.id === 'performance')).toBe(false);
		expect(await repo.git.run(['status', '--porcelain'])).toBe('');
		await profilePlanningCompletion(repo.root, audit);
		await writeFile(join(repo.root, 'plan.md'), 'Done.');
		expect(
			(await service.check({ kind: 'planning', goal: 'Plan catalog search', plan: 'plan.md' }))
				.passed
		).toBe(false);
		await repo.commit();
		expect(
			(await service.check({ kind: 'planning', goal: 'Plan catalog search', plan: 'plan.md' }))
				.passed
		).toBe(false);
	} finally {
		await repo.dispose();
	}
});

test('a coding claim without an actual Harness verification record is refused', async () => {
	const repo = await taskAuditRepo();
	try {
		const audit = await new TaskCompletionService(repo.root).check({
			kind: 'coding',
			goal: 'Implement search'
		});
		expect(audit.passed).toBe(false);
		expect(audit.checks.at(-1)?.detail).toContain('harness verify run');
	} finally {
		await repo.dispose();
	}
});

test('planning heuristics require all sections, acceptance items and a real measurement plan', () => {
	const service = new TaskCompletionService('.');
	expect(() => service.requirePlan(completeProposal, 'Plan search')).not.toThrow();
	for (const text of [
		'Done.',
		completeProposal.replace('## Dependencies', 'Dependencies'),
		completeProposal.replace('measure search latency and process memory', 'make it fast'),
		`${completeProposal}\nTODO add the error behavior`
	])
		expect(() => service.requirePlan(text, 'Plan search')).toThrow('completion audit');
});

test('planning loops finish only on a committed task and reject edits to its declared contract', async () => {
	const repo = await taskAuditRepo();
	try {
		const loop = 'search-plan';
		await createLoop({
			root: repo.root,
			name: loop,
			goal: 'Plan catalog search',
			kind: 'planning',
			plan: 'plan.md'
		});
		await addLoopStep({ root: repo.root, loop, step: 'verify', title: 'Inspect the plan' });
		await repo.commit();
		await profilePlanningLoop(repo.root, loop);
		const result = await completeLoopStep({
			root: repo.root,
			loop,
			step: 'verify',
			evidence: 'Plan audited'
		});
		expect(result.state.steps[0].status).toBe('complete');
		const path = join(repo.root, 'specification/loops/search-plan/loop.json');
		await writeFile(path, JSON.stringify({ ...result.state, goal: 'Different task' }));
		const audit = await new TaskCompletionService(repo.root).check({
			kind: 'planning',
			goal: 'Different task',
			plan: 'plan.md',
			loop
		});
		expect(audit.passed).toBe(false);
		expect(audit.checks.at(-1)?.detail).toContain('Commit the task goal');
	} finally {
		await repo.dispose();
	}
});
