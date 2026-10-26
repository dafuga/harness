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

const schemaPath = '../../../src/repositories/agents-providers/module-task-repository/taskSchemas';
const sourceCommit = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const wantedContract = {
	responsibility: 'Render the approved checkout page',
	inputs: [],
	outputs: [{ name: 'page', type: 'HTML' }],
	errors: []
};
const taskInput = {
	id: 'checkout.page',
	title: 'Build checkout page',
	feature: 'checkout',
	module: 'view.checkout',
	moduleGoal: 'Render checkout',
	verificationFiles: ['test/checkout.test.ts'],
	assignedFiles: ['src/checkout.ts'],
	role: 'implementation',
	instructions: 'Implement the approved checkout contract',
	wantedContract,
	model: 'auto'
};
function planFixture() {
	return {
		feature: 'checkout',
		sourceCommit,
		revision: 1,
		goal: 'Approve checkout before implementation',
		tldr: 'Review checkout design and contract',
		pages: [
			{
				module: 'view.checkout',
				options: [
					{
						id: 'compact',
						version: 'v1',
						commit: sourceCommit,
						path: 'design/checkout.png',
						sha256: digest,
						preferred: true
					}
				],
				selected: 'compact'
			}
		],
		changes: [
			{
				unit: 'view.checkout',
				parent: 'feature.checkout',
				kind: 'modify',
				wantedContract,
				assignedFiles: ['src/checkout.ts']
			}
		],
		tasks: [{ ...taskInput, dependsOn: ['checkout.contract'] }],
		digest,
		approval: { digest, reviewer: 'daniel', approvedAt: '2026-10-26T19:00:00.000Z' }
	};
}
async function publicPlanSchema() {
	const schemas = await import(schemaPath);
	expect(schemas).toHaveProperty('planSchema');
	return schemas.planSchema;
}
test('version-1 queues and legacy task inputs remain valid without plans or prerequisites', async () => {
	const { queueSchema, taskInputSchema } = await import(schemaPath);
	const legacy = { schemaVersion: 1, features: [], tasks: [] };
	const parsed = queueSchema.parse(legacy);
	expect(parsed.schemaVersion).toBe(1);
	expect(parsed.features).toEqual([]);
	expect(parsed.tasks).toEqual([]);
	expect(taskInputSchema.parse(taskInput)).toMatchObject(taskInput);
});
test('approved plans and task prerequisites survive queue JSON serialization without stripping', async () => {
	const { queueSchema, taskInputSchema } = await import(schemaPath);
	const planSchema = await publicPlanSchema();
	const plan = planFixture();
	expect(planSchema.parse(plan)).toEqual(plan);
	expect(taskInputSchema.parse(plan.tasks[0])).toEqual(plan.tasks[0]);
	const queue = {
		schemaVersion: 1,
		features: [{ id: 'checkout', goal: plan.goal, tldr: plan.tldr }],
		tasks: [],
		plans: [plan]
	};
	expect(queueSchema.parse(JSON.parse(JSON.stringify(queueSchema.parse(queue))))).toEqual(queue);
});
test('draft plans parse without approval or selected page options', async () => {
	const planSchema = await publicPlanSchema();
	const { approval: _approval, ...plan } = planFixture();
	const { selected: _selected, ...page } = plan.pages[0];
	const draft = { ...plan, pages: [page] };
	expect(planSchema.parse(draft)).toEqual(draft);
});
test('malformed image hashes, source commits, revisions and unsafe paths are rejected', async () => {
	const planSchema = await publicPlanSchema();
	const plan = planFixture();
	for (const sha256 of ['', 'xyz', 'a'.repeat(63), 'g'.repeat(64)]) {
		const page = { ...plan.pages[0], options: [{ ...plan.pages[0].options[0], sha256 }] };
		expect(planSchema.safeParse({ ...plan, pages: [page] }).success).toBe(false);
	}
	const optionWithoutVersion = { ...plan.pages[0].options[0], version: '' };
	expect(
		planSchema.safeParse({
			...plan,
			pages: [{ ...plan.pages[0], options: [optionWithoutVersion] }]
		}).success
	).toBe(false);
	for (const patch of [
		{ sourceCommit: 'main' },
		{ revision: 0 },
		{ revision: 1.5 },
		{ digest: 'invalid' }
	]) {
		expect(planSchema.safeParse({ ...plan, ...patch }).success).toBe(false);
	}
	const page = {
		...plan.pages[0],
		options: [{ ...plan.pages[0].options[0], path: '../checkout.png' }]
	};
	expect(planSchema.safeParse({ ...plan, pages: [page] }).success).toBe(false);
});
test('duplicate prerequisites and unknown task keys are rejected', async () => {
	const { taskInputSchema } = await import(schemaPath);
	expect(
		taskInputSchema.safeParse({ ...taskInput, dependsOn: ['checkout.contract'] }).success
	).toBe(true);
	expect(
		taskInputSchema.safeParse({
			...taskInput,
			dependsOn: ['checkout.contract', 'checkout.contract']
		}).success
	).toBe(false);
	expect(taskInputSchema.safeParse({ ...taskInput, unexpected: true }).success).toBe(false);
});
test('unknown plan, nested plan and queue keys reject instead of silently stripping', async () => {
	const { queueSchema } = await import(schemaPath);
	const planSchema = await publicPlanSchema();
	const plan = planFixture();
	const page = plan.pages[0];
	const invalidPlans = [
		{ ...plan, unexpected: true },
		{ ...plan, pages: [{ ...page, unexpected: true }] },
		{ ...plan, pages: [{ ...page, options: [{ ...page.options[0], unexpected: true }] }] },
		{ ...plan, changes: [{ ...plan.changes[0], unexpected: true }] },
		{ ...plan, tasks: [{ ...plan.tasks[0], unexpected: true }] },
		{ ...plan, approval: { ...plan.approval, unexpected: true } }
	];
	for (const invalid of invalidPlans) expect(planSchema.safeParse(invalid).success).toBe(false);
	expect(
		queueSchema.safeParse({
			schemaVersion: 1,
			features: [],
			tasks: [],
			plans: [plan],
			unexpected: true
		}).success
	).toBe(false);
});
