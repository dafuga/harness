import { isDeepStrictEqual } from 'node:util';
import { planSchema } from '../../repositories/agents-providers/module-task-repository/taskSchemas';
import type { FeaturePlan } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type {
	FeaturePlanValidatorOptions,
	FeaturePlanValidatorResult
} from './FeaturePlanValidator.types';

export class FeaturePlanValidator {
	validate(input: unknown, options: FeaturePlanValidatorOptions = {}): FeaturePlanValidatorResult {
		try {
			const parsed = planSchema.safeParse(input);
			if (!parsed.success) return { valid: false, errors: ['Invalid feature plan schema'] };
			const plan = parsed.data;
			const errors: string[] = [];
			const pageIds = plan.pages.map((page) => page.module);
			const changeIds = plan.changes.map((change) => change.unit);
			const taskIds = plan.tasks.map((task) => task.id);
			this.unique(pageIds, 'page', errors);
			this.unique(changeIds, 'change', errors);
			this.unique(taskIds, 'task', errors);
			this.pages(plan, options, errors);
			this.tasks(plan, errors);
			this.graph(
				new Map(plan.changes.map((change) => [change.unit, change.parent ? [change.parent] : []])),
				'parent',
				errors
			);
			this.graph(
				new Map(plan.tasks.map((task) => [task.id, task.dependsOn ?? []])),
				'dependency',
				errors
			);
			return { valid: errors.length === 0, errors };
		} catch {
			return { valid: false, errors: ['Invalid feature plan input'] };
		}
	}

	private unique(ids: string[], kind: string, errors: string[]): void {
		const seen = new Set<string>();
		for (const id of ids) {
			if (seen.has(id)) errors.push(`Duplicate ${kind} ID: ${id}`);
			seen.add(id);
		}
	}

	private pages(plan: FeaturePlan, options: FeaturePlanValidatorOptions, errors: string[]): void {
		for (const page of plan.pages) {
			this.unique(
				page.options.map((option) => option.id),
				`option for ${page.module}`,
				errors
			);
			if (page.options.filter((option) => option.preferred).length !== 1)
				errors.push(`Page ${page.module} must have exactly one preferred option`);
			if (page.selected === undefined && options.requireSelection)
				errors.push(`Page ${page.module} requires a selected option`);
			if (
				page.selected !== undefined &&
				!page.options.some((option) => option.id === page.selected)
			)
				errors.push(`Page ${page.module} selected option does not exist`);
		}
	}

	private tasks(plan: FeaturePlan, errors: string[]): void {
		const changes = new Map(plan.changes.map((change) => [change.unit, change]));
		for (const change of plan.changes) {
			if (change.kind !== 'reuse' && !change.wantedContract)
				errors.push(`Change ${change.unit} requires a wanted contract`);
		}
		for (const task of plan.tasks)
			validateTask(task, plan.feature, changes.get(task.module), errors);
	}

	private graph(edges: Map<string, string[]>, kind: string, errors: string[]): void {
		const remaining = new Map<string, number>();
		const dependents = new Map<string, string[]>();
		for (const [id, references] of edges) {
			remaining.set(id, 0);
			for (const reference of references) {
				if (!edges.has(reference)) {
					errors.push(`Missing ${kind} reference ${reference} for ${id}`);
					continue;
				}
				remaining.set(id, remaining.get(id)! + 1);
				const children = dependents.get(reference) ?? [];
				children.push(id);
				dependents.set(reference, children);
			}
		}
		const ready = [...remaining.keys()].filter((id) => remaining.get(id) === 0);
		for (let index = 0; index < ready.length; index++) {
			for (const dependent of dependents.get(ready[index]) ?? []) {
				const count = remaining.get(dependent)! - 1;
				remaining.set(dependent, count);
				if (count === 0) ready.push(dependent);
			}
		}
		if (ready.length !== edges.size) errors.push(`Cyclic ${kind} graph`);
	}
}

function validateTask(
	task: FeaturePlan['tasks'][number],
	feature: string,
	change: FeaturePlan['changes'][number] | undefined,
	errors: string[]
): void {
	if (task.feature !== feature) errors.push(`Task ${task.id} belongs to another feature`);
	if (!change) {
		errors.push(`Task ${task.id} module is not planned`);
		return;
	}
	if (
		task.role === 'implementation' &&
		!isDeepStrictEqual(task.wantedContract, change.wantedContract)
	)
		errors.push(`Task ${task.id} wanted contract does not match its planned module`);
	const allowed = new Set([
		...change.assignedFiles,
		...(task.role === 'verification' ? (task.verificationFiles ?? []) : [])
	]);
	if (!task.assignedFiles?.length || task.assignedFiles.some((file) => !allowed.has(file)))
		errors.push(`Task ${task.id} assigned files exceed or omit its planned scope`);
}

export type {
	FeaturePlanValidatorOptions,
	FeaturePlanValidatorResult
} from './FeaturePlanValidator.types';
