import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { author, contract, fixture } from './planFixture';
import type { ChangeTarget, PlanningApi } from '../src';
async function headless(api: PlanningApi) {
	await api.createPlan({
		category: 'function',
		slug: 'filter',
		title: 'Filter',
		goal: 'Filter',
		author,
		contract
	});
	const design = await api.addDesign({
		unitId: 'function.filter',
		prompt: 'Behavior',
		generator: { provider: 'codex', model: 'selected' },
		images: [],
		notes: 'Behavior'
	});
	const thread = await api.openThread({
		unitId: 'function.filter',
		version: null,
		file: null,
		imageSha256: null,
		region: null,
		author
	});
	const approval = await api.approveDesign({
		unitId: 'function.filter',
		version: 'v001',
		images: [],
		notesSha256: design.value.notes!.sha256,
		contractHash: design.value.contractHash,
		reviewer: 'Reviewer'
	});
	const target: ChangeTarget = {
		approvalId: approval.value.id,
		version: 'v001',
		imageSha256: null,
		contractHash: design.value.contractHash
	};
	return { thread, target };
}
test('notes-only approved changes bind exact current approval and record cancellation', async () => {
	const { api } = await fixture();
	const { thread, target } = await headless(api);
	const message = {
		unitId: 'function.filter',
		threadId: thread.value.id,
		author,
		mode: 'change' as const,
		body: 'Implement approved behavior'
	};
	await expect(
		api.appendMessage({
			...message,
			change: { target: { ...target, contractHash: 'wrong' }, status: 'requested' }
		})
	).rejects.toThrow();
	const requested = await api.appendMessage({
		...message,
		change: { target, status: 'requested' }
	});
	expect(requested.value.change?.target.imageSha256).toBeNull();
	const cancelled = await api.appendMessage({
		...message,
		body: 'Cancelled',
		change: { target, status: 'cancelled' }
	});
	expect(cancelled.value.change?.status).toBe('cancelled');
	await api.addDesign({
		unitId: 'function.filter',
		prompt: 'Revision',
		generator: { provider: 'codex', model: 'selected' },
		images: [],
		notes: 'Revised'
	});
	await expect(
		api.appendMessage({ ...message, change: { target, status: 'requested' } })
	).rejects.toThrow('current approval');
});
