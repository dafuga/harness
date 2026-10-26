import { createHash } from 'node:crypto';
import type { FeaturePlanRepository } from '../../repositories/agents-providers/FeaturePlanRepository';
import type { FeaturePlan } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import { planSchema } from '../../repositories/agents-providers/module-task-repository/taskSchemas';
import type { FeaturePlanValidator } from '../../validators/agents-providers/FeaturePlanValidator';

type Dependencies = {
	repository: Pick<FeaturePlanRepository, 'read' | 'append' | 'approve'>;
	validator: Pick<FeaturePlanValidator, 'validate'>;
	verifyReady?: (plan: FeaturePlan) => Promise<void>;
	now?: () => string;
};
type Draft = Omit<FeaturePlan, 'revision' | 'digest' | 'approval'>;
type Selection = { feature: string; page: string; option: string; expectedDigest: string };
type Approval = { feature: string; expectedDigest: string; reviewer: string };

function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
	if (value !== null && typeof value === 'object') {
		const object = value as Record<string, unknown>;
		const entries = Object.keys(object)
			.filter((key) => object[key] !== undefined)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`);
		return `{${entries.join(',')}}`;
	}
	return JSON.stringify(value) ?? 'null';
}

function digest(plan: FeaturePlan): string {
	const { digest: _digest, approval: _approval, ...content } = plan;
	return createHash('sha256').update(canonical(content)).digest('hex');
}

export class FeaturePlanService {
	constructor(private readonly dependencies?: Dependencies) {}

	run(): string {
		return 'feature-plan';
	}

	async draft(input: Draft): Promise<FeaturePlan> {
		if (['revision', 'digest', 'approval'].some((key) => key in input))
			throw new Error('Draft input must not contain revision, digest or approval.');
		const candidate = structuredClone(input);
		const latest = await this.latest(candidate.feature);
		return this.append(candidate, (latest?.revision ?? 0) + 1);
	}

	async select(input: Selection): Promise<FeaturePlan> {
		const latest = await this.expected(input.feature, input.expectedDigest);
		const { revision, digest: _digest, approval: _approval, ...candidate } = latest;
		const page = candidate.pages.find((entry) => entry.module === input.page);
		if (!page || !page.options.some((option) => option.id === input.option))
			throw new Error('Unknown page or design option.');
		page.selected = input.option;
		return this.append(candidate, revision + 1);
	}

	async approve(input: Approval): Promise<FeaturePlan> {
		const dependencies = this.required();
		if (!dependencies.verifyReady) throw new Error('Trusted readiness verification is required.');
		const latest = await this.expected(input.feature, input.expectedDigest);
		this.validate(latest, true);
		const approval = {
			digest: latest.digest,
			reviewer: input.reviewer,
			approvedAt: (dependencies.now ?? (() => new Date().toISOString()))()
		};
		planSchema.parse({ ...latest, approval });
		await dependencies.verifyReady(structuredClone(latest));
		await this.expected(input.feature, input.expectedDigest);
		const result = await dependencies.repository.approve({
			feature: latest.feature,
			revision: latest.revision,
			...approval
		});
		return structuredClone(result.plan);
	}

	private required(): Dependencies {
		if (!this.dependencies) throw new Error('Feature plan dependencies are required.');
		return this.dependencies;
	}

	private validate(plan: FeaturePlan, requireSelection = false): void {
		const result = this.required().validator.validate(plan, { requireSelection });
		if (!result.valid) throw new Error(`Invalid feature plan: ${result.errors.join('; ')}`);
	}

	private async latest(feature: string): Promise<FeaturePlan | undefined> {
		const { plans } = await this.required().repository.read(feature);
		const latest = plans.at(-1);
		if (!latest) return undefined;
		const copy = structuredClone(latest);
		planSchema.parse(copy);
		this.validate(copy);
		if (copy.feature !== feature || copy.digest !== digest(copy))
			throw new Error('Stored feature plan digest does not match its content.');
		return copy;
	}

	private async expected(feature: string, expectedDigest: string): Promise<FeaturePlan> {
		const latest = await this.latest(feature);
		if (!latest || latest.digest !== expectedDigest) throw new Error('Stale feature plan digest.');
		return latest;
	}

	private async append(input: Draft, revision: number): Promise<FeaturePlan> {
		const plan = planSchema.parse({ ...input, revision, digest: '0'.repeat(64) });
		this.validate(plan);
		plan.digest = digest(plan);
		const result = await this.required().repository.append(plan);
		return structuredClone(result.plan);
	}
}
