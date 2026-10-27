import { afterEach, expect, test, vi } from 'vitest';
import { FeaturePlanRepository } from '../../../../../src/repositories/agents-providers/FeaturePlanRepository';
import { FeaturePlanService } from '../../../../../src/services/agents-providers/FeaturePlanService';
import { ModuleTaskServerService } from '../../../../../src/services/agents-providers/ModuleTaskServerService';
import type { FeaturePlan } from '../../../../../src/repositories/agents-providers/ModuleTaskRepository.types';
import type { BridgeContext } from '../../../src/lib/development-tooling/desktop-bridge/desktopBridge.types';
import { featurePlanAction } from '../../../src/utils/development-tooling/featurePlanAction';

const digest = 'a'.repeat(64),
	source = 'b'.repeat(40);
const plan = {
	feature: 'feature',
	sourceCommit: source,
	revision: 1,
	goal: 'Goal',
	tldr: 'Summary',
	pages: [],
	changes: [],
	tasks: [],
	digest
} satisfies FeaturePlan;
const approved = {
	...plan,
	approval: { digest, reviewer: 'Daniel', approvedAt: '2026-10-27T00:00:00.000Z' }
};
const selection = {
	projectId: 'project-a',
	feature: 'feature',
	page: 'page',
	option: 'o1',
	expectedDigest: digest
};
const approval = {
	projectId: 'project-a',
	feature: 'feature',
	reviewer: 'Daniel',
	expectedDigest: digest
};

function fixture() {
	const assertProject = vi.fn((id: string) => {
		if (id !== 'project-a') throw new Error('Wrong project.');
	});
	const context = { session: { assertProject } } as unknown as BridgeContext;
	const project = { root: '/fixture', revision: { commit: source } } as Awaited<
		ReturnType<BridgeContext['session']['mutable']>
	>;
	const writable = vi.fn(async () => project);
	const read = vi
		.spyOn(FeaturePlanRepository.prototype, 'read')
		.mockResolvedValue({ commit: undefined, plans: [plan] });
	const select = vi.spyOn(FeaturePlanService.prototype, 'select').mockResolvedValue(plan);
	const approve = vi.spyOn(FeaturePlanService.prototype, 'approve').mockResolvedValue(approved);
	const submit = vi
		.spyOn(ModuleTaskServerService.prototype, 'submitApproved')
		.mockResolvedValue({ created: ['feature.task'], reused: [], commit: undefined });
	return { context, project, writable, read, select, approve, submit };
}
afterEach(() => vi.restoreAllMocks());

test('featurePlanAction rejects a foreign project and stale plan before a write', async () => {
	const f = fixture();
	await expect(
		featurePlanAction(f.context, { ...selection, projectId: 'other' }, f.writable)
	).rejects.toThrow('Wrong project');
	await expect(
		featurePlanAction(f.context, { ...selection, expectedDigest: 'c'.repeat(64) }, f.writable)
	).rejects.toThrow('changed');
	f.read.mockResolvedValueOnce({
		commit: undefined,
		plans: [{ ...plan, sourceCommit: 'c'.repeat(40) }]
	});
	await expect(featurePlanAction(f.context, selection, f.writable)).rejects.toThrow('changed');
	expect(f.select).not.toHaveBeenCalled();
	expect(f.approve).not.toHaveBeenCalled();
	expect(f.submit).not.toHaveBeenCalled();
});

test('featurePlanAction refuses a changed revision before selection or task admission', async () => {
	const f = fixture(),
		changed = { ...f.project, revision: { ...f.project.revision, commit: 'c'.repeat(40) } };
	f.writable.mockResolvedValueOnce(f.project).mockResolvedValueOnce(changed);
	await expect(featurePlanAction(f.context, selection, f.writable)).rejects.toThrow(
		'revision has changed'
	);
	expect(f.select).not.toHaveBeenCalled();
	f.writable
		.mockResolvedValueOnce(f.project)
		.mockResolvedValueOnce(f.project)
		.mockResolvedValueOnce(changed);
	await expect(featurePlanAction(f.context, approval, f.writable)).rejects.toThrow(
		'revision has changed'
	);
	expect(f.approve).toHaveBeenCalledOnce();
	expect(f.submit).not.toHaveBeenCalled();
});

test('featurePlanAction propagates readiness and queue errors and submits only the approved digest', async () => {
	const f = fixture();
	f.approve.mockRejectedValueOnce(new Error('Not ready.'));
	await expect(featurePlanAction(f.context, approval, f.writable)).rejects.toThrow('Not ready');
	expect(f.submit).not.toHaveBeenCalled();
	f.submit.mockRejectedValueOnce(new Error('Queue unavailable.'));
	await expect(featurePlanAction(f.context, approval, f.writable)).rejects.toThrow(
		'Queue unavailable'
	);
	await expect(featurePlanAction(f.context, approval, f.writable)).resolves.toEqual(approved);
	expect(f.submit).toHaveBeenCalledWith({ feature: 'feature', expectedDigest: digest });
});
