import { createHash } from 'node:crypto';
import { expect, vi } from 'vitest';
import { FeaturePlanService } from '../../../src/services/agents-providers/FeaturePlanService';
import { FeaturePlanValidator } from '../../../src/validators/agents-providers/FeaturePlanValidator';
import type { FeaturePlan } from '../../../src/repositories/agents-providers/ModuleTaskRepository.types';
function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
	if (value !== null && typeof value === 'object') {
		return `{${Object.entries(value)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
			.join(',')}}`;
	}
	return JSON.stringify(value);
}
export function digest(plan: FeaturePlan) {
	const { digest: _digest, approval: _approval, ...content } = plan;
	return createHash('sha256').update(canonical(content)).digest('hex');
}
export function fixture() {
	const plans: FeaturePlan[] = [];
	const repository = {
		read: vi.fn(async () => ({ commit: 'queue', plans: structuredClone(plans) })),
		append: vi.fn(async (plan: FeaturePlan) => {
			plans.push(structuredClone(plan));
			return { commit: 'queue', plan: structuredClone(plan) };
		}),
		approve: vi.fn(
			async (input: {
				feature: string;
				revision: number;
				digest: string;
				reviewer: string;
				approvedAt: string;
			}) => {
				const current = plans.at(-1)!;
				current.approval = {
					digest: input.digest,
					reviewer: input.reviewer,
					approvedAt: input.approvedAt
				};
				return { commit: 'queue', plan: structuredClone(current) };
			}
		)
	};
	const verifyReady = vi.fn(async (_plan: FeaturePlan) => {});
	const dependencies = {
		repository,
		validator: new FeaturePlanValidator(),
		verifyReady,
		now: () => '2026-10-26T12:00:00.000Z'
	};
	return {
		plans,
		repository,
		verifyReady,
		dependencies,
		service: new FeaturePlanService(dependencies)
	};
}

function approvedFixture(plan: FeaturePlan) {
	const state = fixture();
	state.plans.push(structuredClone(plan));
	return state;
}

async function assertRejectedApprovals(plan: FeaturePlan) {
	for (const kind of [
		'missing',
		'unapproved',
		'stale',
		'wrong-approval',
		'tampered',
		'unselected',
		'unready',
		'no-verifier'
	] as const) {
		const state = approvedFixture(plan);
		const stored = state.plans[0];
		const request = { feature: plan.feature, expectedDigest: plan.digest };
		if (kind === 'missing') state.plans.splice(0);
		if (kind === 'unapproved') delete stored.approval;
		if (kind === 'stale') request.expectedDigest = 'f'.repeat(64);
		if (kind === 'wrong-approval') stored.approval!.digest = 'f'.repeat(64);
		if (kind === 'tampered') stored.goal = 'Unapproved mutation';
		if (kind === 'unselected') {
			delete stored.pages[0].selected;
			stored.digest = digest(stored);
			stored.approval!.digest = stored.digest;
			request.expectedDigest = stored.digest;
		}
		const failure = new Error('Readiness rejected');
		if (kind === 'unready') state.verifyReady.mockRejectedValue(failure);
		const before = structuredClone(state.plans);
		const service =
			kind === 'no-verifier'
				? new FeaturePlanService({ ...state.dependencies, verifyReady: undefined })
				: state.service;
		if (kind === 'unready') await expect(service.approved(request)).rejects.toBe(failure);
		else await expect(service.approved(request)).rejects.toThrow();
		expect(state.plans).toEqual(before);
		expect(state.repository.append).not.toHaveBeenCalled();
		expect(state.repository.approve).not.toHaveBeenCalled();
		if (!['unready', 'no-verifier'].includes(kind))
			expect(state.verifyReady).not.toHaveBeenCalled();
	}
}

async function assertConcurrentChanges(plan: FeaturePlan) {
	for (const kind of ['revision', 'approval', 'revocation', 'content'] as const) {
		const state = approvedFixture(plan);
		let afterExternalChange = structuredClone(state.plans);
		state.verifyReady.mockImplementationOnce(async () => {
			const current = state.plans[0];
			if (kind === 'revision')
				state.plans.push({ ...structuredClone(current), revision: current.revision + 1 });
			if (kind === 'approval') current.approval!.reviewer = 'Another reviewer';
			if (kind === 'revocation') delete current.approval;
			if (kind === 'content') current.goal = 'Concurrent mutation';
			afterExternalChange = structuredClone(state.plans);
		});
		await expect(
			state.service.approved({ feature: plan.feature, expectedDigest: plan.digest })
		).rejects.toThrow();
		expect(state.repository.read).toHaveBeenCalledTimes(2);
		expect(state.verifyReady).toHaveBeenCalledOnce();
		expect(state.plans).toEqual(afterExternalChange);
		expect(state.repository.append).not.toHaveBeenCalled();
		expect(state.repository.approve).not.toHaveBeenCalled();
	}
}

export async function assertApprovedGuard(plan: FeaturePlan) {
	const state = approvedFixture(plan);
	const before = structuredClone(state.plans);
	const approved = await state.service.approved({
		feature: plan.feature,
		expectedDigest: plan.digest
	});
	expect(approved).toEqual(plan);
	expect(state.verifyReady).toHaveBeenCalledExactlyOnceWith(plan);
	expect(state.repository.read).toHaveBeenCalledTimes(2);
	expect(state.plans).toEqual(before);
	expect(state.repository.append).not.toHaveBeenCalled();
	expect(state.repository.approve).not.toHaveBeenCalled();
	await assertRejectedApprovals(plan);
	await assertConcurrentChanges(plan);
}
