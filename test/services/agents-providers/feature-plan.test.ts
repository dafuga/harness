import { expect, test } from 'vitest';
import { FeaturePlanService } from '../../../src/services/agents-providers/FeaturePlanService';
import { assertApprovedGuard, digest, fixture } from './feature-plan-approval.test.fixtures';
import type { FeaturePlan } from '../../../src/repositories/agents-providers/ModuleTaskRepository.types';
test('FeaturePlanService.run from default initialization returns the file name', () => {
	expect(new FeaturePlanService().run()).toBe('feature-plan');
});
function proposal(): Omit<FeaturePlan, 'revision' | 'digest' | 'approval'> {
	return {
		feature: 'checkout',
		sourceCommit: 'a'.repeat(40),
		goal: 'Review checkout',
		tldr: 'Build checkout',
		pages: [
			{
				module: 'page.checkout',
				options: ['first', 'second'].map((id, index) => ({
					id,
					version: 'v1',
					commit: 'b'.repeat(40),
					path: `designs/${id}.png`,
					sha256: String(index + 1).repeat(64),
					preferred: index === 0
				}))
			}
		],
		changes: [{ unit: 'page.checkout', kind: 'reuse', assignedFiles: [] }],
		tasks: []
	};
}
test('FeaturePlanService.draft persists immutable revisions with canonical content digests', async () => {
	const state = fixture();
	const input = proposal();
	expect(
		state.dependencies.validator.validate({ ...input, revision: 1, digest: '1'.repeat(64) })
	).toEqual({ valid: true, errors: [] });
	const first = await state.service.draft(input);
	expect(first).toEqual({ ...input, revision: 1, digest: digest(first) });
	const reordered = Object.fromEntries(Object.entries(input).reverse()) as typeof input;
	const equivalent = await fixture().service.draft(reordered);
	expect(equivalent.digest).toBe(first.digest);
	const second = await state.service.draft({ ...input, goal: 'A changed goal' });
	expect(second.revision).toBe(2);
	expect(second.digest).toBe(digest(second));
	expect(second.digest).not.toBe(first.digest);
	input.goal = 'Caller mutation';
	expect(state.plans[0]).toEqual(first);
	expect(state.plans[1]?.approval).toBeUndefined();
	const before = structuredClone(state.plans);
	await expect(state.service.draft({ ...proposal(), sourceCommit: 'invalid' })).rejects.toThrow();
	expect(state.plans).toEqual(before);
	state.repository.append.mockRejectedValueOnce(new Error('Concurrent revision'));
	await expect(state.service.draft(proposal())).rejects.toThrow('Concurrent revision');
	expect(state.plans).toEqual(before);
});
test('FeaturePlanService.select creates a revision and rejects stale or unknown selections', async () => {
	const state = fixture();
	const first = await state.service.draft(proposal());
	const input = {
		feature: first.feature,
		page: 'page.checkout',
		option: 'second',
		expectedDigest: first.digest
	};
	const selected = await state.service.select(input);
	expect(selected).toEqual({
		...first,
		revision: 2,
		pages: [{ ...first.pages[0], selected: 'second' }],
		digest: digest(selected)
	});
	expect(selected.digest).not.toBe(first.digest);
	expect(state.plans[0]).toEqual(first);
	const before = structuredClone(state.plans);
	for (const invalid of [
		input,
		{ ...input, expectedDigest: selected.digest, page: 'missing' },
		{ ...input, expectedDigest: selected.digest, option: 'missing' }
	]) {
		await expect(state.service.select(invalid)).rejects.toThrow();
		expect(state.plans).toEqual(before);
	}
	state.repository.append.mockRejectedValueOnce(new Error('Concurrent revision'));
	await expect(state.service.select({ ...input, expectedDigest: selected.digest })).rejects.toThrow(
		'Concurrent revision'
	);
	expect(state.plans).toEqual(before);
});
test('FeaturePlanService.approve verifies fully selected latest content before persisting approval', async () => {
	const state = fixture();
	const first = await state.service.draft(proposal());
	const request = {
		feature: first.feature,
		expectedDigest: first.digest,
		reviewer: 'reviewer@example.test'
	};
	await expect(state.service.approve(request)).rejects.toThrow();
	expect(state.repository.approve).not.toHaveBeenCalled();
	const selected = await state.service.select({
		feature: first.feature,
		page: 'page.checkout',
		option: 'first',
		expectedDigest: first.digest
	});
	await expect(state.service.approve(request)).rejects.toThrow();
	expect(state.verifyReady).not.toHaveBeenCalled();
	const approved = await state.service.approve({ ...request, expectedDigest: selected.digest });
	expect(state.verifyReady).toHaveBeenCalledWith(selected);
	expect(state.verifyReady.mock.invocationCallOrder[0]).toBeLessThan(
		state.repository.approve.mock.invocationCallOrder[0]
	);
	expect(approved).toEqual({
		...selected,
		approval: {
			digest: selected.digest,
			reviewer: request.reviewer,
			approvedAt: state.dependencies.now()
		}
	});
	expect(state.plans[0]).toEqual(first);
	await assertApprovedGuard(approved);
});
test('FeaturePlanService.approve fails closed for tampering, absent readiness and repository conflicts', async () => {
	const state = fixture();
	const input = proposal();
	input.pages[0].selected = 'first';
	const plan = await state.service.draft(input);
	const request = {
		feature: plan.feature,
		expectedDigest: plan.digest,
		reviewer: 'reviewer@example.test'
	};
	const before = structuredClone(state.plans);
	state.verifyReady.mockRejectedValueOnce(new Error('Artifact unavailable'));
	await expect(state.service.approve(request)).rejects.toThrow('Artifact unavailable');
	expect(state.plans).toEqual(before);
	expect(state.repository.approve).not.toHaveBeenCalled();
	state.repository.approve.mockRejectedValueOnce(new Error('Concurrent revision'));
	await expect(state.service.approve(request)).rejects.toThrow('Concurrent revision');
	expect(state.plans).toEqual(before);
	state.plans[0].goal = 'Tampered content';
	const calls = state.repository.approve.mock.calls.length;
	await expect(state.service.approve(request)).rejects.toThrow();
	await expect(
		state.service.select({
			feature: plan.feature,
			page: 'page.checkout',
			option: 'second',
			expectedDigest: plan.digest
		})
	).rejects.toThrow();
	expect(state.repository.approve).toHaveBeenCalledTimes(calls);
	expect(state.repository.append).toHaveBeenCalledTimes(1);
	state.plans[0] = structuredClone(plan);
	await expect(async () => {
		const unsafe = new FeaturePlanService({
			...state.dependencies,
			verifyReady: undefined
		});
		await unsafe.approve(request);
	}).rejects.toThrow();
	expect(state.plans).toEqual(before);
	expect(state.repository.approve).toHaveBeenCalledTimes(calls);
});
