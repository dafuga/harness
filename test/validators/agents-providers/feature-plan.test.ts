import { expect, test } from 'vitest';
import { FeaturePlanValidator } from '../../../src/validators/agents-providers/FeaturePlanValidator';

function samplePlan() {
	const wantedContract = {
		responsibility: 'Render the requested page.',
		inputs: [],
		outputs: [{ name: 'page', type: 'string' }],
		errors: []
	};
	return {
		feature: 'sample-feature',
		sourceCommit: 'a'.repeat(40),
		revision: 1,
		goal: 'Show the requested page.',
		tldr: 'Review the page before implementation.',
		pages: [
			{
				module: 'page.sample',
				options: [
					{
						id: 'option-one',
						version: 'v1',
						commit: 'a'.repeat(40),
						path: 'design/page.png',
						sha256: 'b'.repeat(64),
						preferred: true
					}
				]
			}
		],
		changes: [
			{ unit: 'page.sample', kind: 'modify', wantedContract, assignedFiles: ['src/page.ts'] }
		],
		tasks: [
			{
				id: 'sample-feature.page',
				title: 'Implement page',
				feature: 'sample-feature',
				module: 'page.sample',
				role: 'implementation',
				instructions: 'Render the page.',
				wantedContract,
				assignedFiles: ['src/page.ts'],
				model: 'auto',
				dependsOn: [] as string[]
			}
		],
		digest: 'b'.repeat(64)
	};
}

function branchedPlan() {
	const plan = samplePlan();
	return {
		...plan,
		changes: [
			...plan.changes,
			{ ...plan.changes[0], unit: 'page.child', parent: 'page.sample' },
			{ ...plan.changes[0], unit: 'page.independent' }
		],
		tasks: [
			...plan.tasks,
			{
				...plan.tasks[0],
				id: 'sample-feature.child',
				module: 'page.child',
				dependsOn: ['sample-feature.page']
			},
			{ ...plan.tasks[0], id: 'sample-feature.independent', module: 'page.independent' }
		]
	};
}

function invalidGraphs() {
	const plan = samplePlan();
	const branch = branchedPlan();
	const page = plan.pages[0];
	const option = page.options[0];
	const change = plan.changes[0];
	const task = plan.tasks[0];
	return [
		['duplicate pages', { ...plan, pages: [page, page] }],
		[
			'duplicate options',
			{ ...plan, pages: [{ ...page, options: [option, { ...option, preferred: false }] }] }
		],
		['duplicate changes', { ...plan, changes: [change, change] }],
		['duplicate tasks', { ...plan, tasks: [task, task] }],
		[
			'no preferred option',
			{ ...plan, pages: [{ ...page, options: [{ ...option, preferred: false }] }] }
		],
		[
			'multiple preferred options',
			{ ...plan, pages: [{ ...page, options: [option, { ...option, id: 'option-two' }] }] }
		],
		['missing selected option', { ...plan, pages: [{ ...page, selected: 'missing' }] }],
		['missing parent', { ...plan, changes: [{ ...change, parent: 'page.missing' }] }],
		['self parent', { ...plan, changes: [{ ...change, parent: change.unit }] }],
		[
			'parent cycle',
			{ ...branch, changes: [{ ...change, parent: 'page.child' }, ...branch.changes.slice(1)] }
		],
		[
			'missing prerequisite',
			{ ...plan, tasks: [{ ...task, dependsOn: ['sample-feature.missing'] }] }
		],
		['self prerequisite', { ...plan, tasks: [{ ...task, dependsOn: [task.id] }] }],
		[
			'prerequisite cycle',
			{ ...branch, tasks: [{ ...task, dependsOn: ['sample-feature.child'] }, branch.tasks[1]] }
		],
		[
			'duplicate prerequisites',
			{ ...branch, tasks: [task, { ...branch.tasks[1], dependsOn: [task.id, task.id] }] }
		],
		['cross-feature task', { ...plan, tasks: [{ ...task, feature: 'different-feature' }] }],
		['unplanned task module', { ...plan, tasks: [{ ...task, module: 'page.missing' }] }],
		['absent change contract', { ...plan, changes: [{ ...change, wantedContract: undefined }] }],
		['absent removal contract', missingRemovalContract(plan)],
		['absent task contract', { ...plan, tasks: [{ ...task, wantedContract: undefined }] }]
	] as const;
}

function missingRemovalContract(plan: ReturnType<typeof samplePlan>) {
	return {
		...plan,
		changes: [
			...plan.changes,
			{ ...plan.changes[0], unit: 'page.retired', kind: 'remove', wantedContract: undefined }
		]
	};
}

function malformedPlans() {
	const plan = samplePlan();
	const page = plan.pages[0];
	const option = page.options[0];
	return [
		['null', null],
		['empty object', {}],
		['array', []],
		['primitive', 'plan'],
		['unknown root key', { ...plan, unknown: true }],
		['unknown page key', { ...plan, pages: [{ ...page, unknown: true }] }],
		[
			'unknown option key',
			{ ...plan, pages: [{ ...page, options: [{ ...option, unknown: true }] }] }
		],
		['unknown change key', { ...plan, changes: [{ ...plan.changes[0], unknown: true }] }],
		['unknown task key', { ...plan, tasks: [{ ...plan.tasks[0], unknown: true }] }],
		['invalid revision', { ...plan, revision: 0 }],
		['invalid source commit', { ...plan, sourceCommit: 'main' }],
		['invalid digest', { ...plan, digest: 'bad' }],
		[
			'unsafe option path',
			{ ...plan, pages: [{ ...page, options: [{ ...option, path: '../escape.png' }] }] }
		],
		[
			'absent option version',
			{ ...plan, pages: [{ ...page, options: [{ ...option, version: undefined }] }] }
		]
	] as const;
}

test('FeaturePlanValidator.validate from default initialization covers supported and invalid inputs', () => {
	const validator = new FeaturePlanValidator();
	const draft = samplePlan();
	const selected = {
		...draft,
		pages: [{ ...draft.pages[0], selected: 'option-one' }]
	};
	const alternative = {
		...selected,
		pages: [
			{
				...selected.pages[0],
				selected: 'option-two',
				options: [
					...draft.pages[0].options,
					{ ...draft.pages[0].options[0], id: 'option-two', preferred: false }
				]
			}
		]
	};
	const removal = {
		...draft,
		changes: [...draft.changes, { ...draft.changes[0], unit: 'page.retired', kind: 'remove' }]
	};
	for (const valid of [draft, branchedPlan(), removal]) {
		const before = structuredClone(valid);
		expect(validator.validate(valid)).toEqual({ valid: true, errors: [] });
		expect(valid).toEqual(before);
	}
	for (const valid of [selected, alternative]) {
		const before = structuredClone(valid);
		expect(validator.validate(valid, { requireSelection: true })).toEqual({
			valid: true,
			errors: []
		});
		expect(valid).toEqual(before);
	}
	for (const [label, invalid] of [...malformedPlans(), ...invalidGraphs()]) {
		const before = structuredClone(invalid);
		const result = validator.validate(invalid);
		expect(result, label).toEqual({ valid: false, errors: expect.any(Array) });
		expect(result.errors.length, label).toBeGreaterThan(0);
		for (const error of result.errors) expect(error, label).toEqual(expect.any(String));
		expect(invalid, label).toEqual(before);
	}
	const missingSelection = validator.validate(draft, { requireSelection: true });
	expect(missingSelection).toEqual({ valid: false, errors: expect.any(Array) });
	expect(missingSelection.errors.length).toBeGreaterThan(0);
});
