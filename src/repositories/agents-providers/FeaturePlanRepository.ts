import { isDeepStrictEqual } from 'node:util';
import { ModuleTaskRepository } from './ModuleTaskRepository';
import { planApprovalSchema, planSchema } from './module-task-repository/taskSchemas';
import type { FeaturePlan } from './ModuleTaskRepository.types';
import type {
	FeaturePlanApprovalInput,
	FeaturePlanReadResult,
	FeaturePlanWriteResult,
	FeaturePlanQueueRepository,
	RepositoryRecord
} from './FeaturePlanRepository.types';

const approvalInputSchema = planSchema
	.pick({ feature: true, revision: true })
	.extend(planApprovalSchema.shape);

export class FeaturePlanRepository<T extends RepositoryRecord = RepositoryRecord> {
	private readonly records = new Map<number, T>();
	private readonly repository: FeaturePlanQueueRepository;

	constructor(root = process.cwd(), repository?: FeaturePlanQueueRepository) {
		this.repository = repository ?? new ModuleTaskRepository(root);
	}

	find(id: number): T | undefined {
		return this.records.get(id);
	}

	save(record: T): T {
		this.records.set(record.id, record);
		return record;
	}

	async read(feature: string): Promise<FeaturePlanReadResult> {
		const { commit, data } = await this.repository.read();
		const plans = (data.plans ?? [])
			.filter((plan) => plan.feature === feature)
			.sort((left, right) => left.revision - right.revision);
		return { commit, plans };
	}

	async append(input: FeaturePlan): Promise<FeaturePlanWriteResult> {
		const plan = planSchema.parse(input);
		if (plan.approval) throw new Error('Cannot append a pre-approved plan');
		const result = await this.repository.update((queue) => {
			const plans = queue.plans ?? [];
			const revisions = plans.filter((stored) => stored.feature === plan.feature);
			const existing = revisions.find((stored) => stored.revision === plan.revision);
			if (existing) {
				if (!isDeepStrictEqual(existing, plan)) throw new Error('Conflicting plan revision');
				return existing;
			}
			const latest = revisions.reduce((revision, stored) => Math.max(revision, stored.revision), 0);
			if (plan.revision !== latest + 1) throw new Error('Plan revision must be sequential');
			const appended = planSchema.parse(plan);
			queue.plans = [...plans, appended];
			return appended;
		}, plan.sourceCommit);
		return { commit: result.commit, plan: result.value };
	}

	async approve(input: FeaturePlanApprovalInput): Promise<FeaturePlanWriteResult> {
		const { feature, revision, ...approval } = approvalInputSchema.parse(input);
		const result = await this.repository.update((queue) => {
			const plans = queue.plans ?? [];
			const latest = plans
				.filter((plan) => plan.feature === feature)
				.reduce<
					FeaturePlan | undefined
				>((found, plan) => (!found || plan.revision > found.revision ? plan : found), undefined);
			if (!latest || latest.revision !== revision || latest.digest !== approval.digest)
				throw new Error('Stale plan revision or digest');
			if (latest.approval) {
				if (!isDeepStrictEqual(latest.approval, approval))
					throw new Error('Conflicting plan approval');
				return latest;
			}
			const approved = planSchema.parse({ ...latest, approval });
			queue.plans = plans.map((plan) => (plan === latest ? approved : plan));
			return approved;
		});
		return { commit: result.commit, plan: result.value };
	}
}

export type {
	FeaturePlanApprovalInput,
	FeaturePlanReadResult,
	FeaturePlanWriteResult,
	FeaturePlanQueueRepository,
	RepositoryRecord
} from './FeaturePlanRepository.types';
