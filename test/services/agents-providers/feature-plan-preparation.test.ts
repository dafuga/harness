import { expect, test, vi } from 'vitest';
import { FeaturePlanPreparationService } from '../../../src/services/agents-providers/FeaturePlanPreparationService';
import {
	sourceCommit,
	finalCommit,
	proposal,
	page,
	fixture
} from './feature-plan-preparation.test.fixtures';
async function assertPreparedPages(ids: string[]) {
	const { deps, input, service } = fixture(ids);
	const before = structuredClone({ proposal: input.proposal, data: input.data });
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	deps.preparePage.mockImplementation(async ({ module }) => {
		await gate;
		return page(module);
	});
	const pending = service.prepare(input);
	const unique = [...new Set(ids)].sort();
	try {
		await vi.waitFor(() => expect(deps.preparePage).toHaveBeenCalledTimes(unique.length));
		expect(deps.admit).toHaveBeenCalledTimes(unique.length);
		expect(deps.finalize).not.toHaveBeenCalled();
		expect(deps.draft).not.toHaveBeenCalled();
	} finally {
		release();
	}
	const result = await pending;
	const pages = unique.map(page);
	expect(deps.discover).toHaveBeenCalledExactlyOnceWith(
		{ sourceCommit, changes: proposal.changes },
		input.data
	);
	for (const module of unique)
		expect(deps.preparePage).toHaveBeenCalledWith({
			module,
			sourceCommit,
			count: 3,
			signal: input.signal
		});
	expect(deps.finalize).toHaveBeenCalledExactlyOnceWith({ sourceCommit, pages }, input.signal);
	const draft = { ...proposal, sourceCommit: finalCommit, pages };
	expect(deps.verify).toHaveBeenCalledExactlyOnceWith(draft, { commit: finalCommit });
	expect(deps.draft).toHaveBeenCalledExactlyOnceWith(draft);
	expect(result).toEqual({ ...draft, revision: 1, digest: 'd'.repeat(64) });
	expect(result).not.toHaveProperty('approval');
	expect(result.pages.every((item) => item.selected === undefined)).toBe(true);
	expect(deps.verify.mock.invocationCallOrder[0]).toBeGreaterThan(
		deps.finalize.mock.invocationCallOrder[0]!
	);
	expect(deps.draft.mock.invocationCallOrder[0]).toBeGreaterThan(
		deps.verify.mock.invocationCallOrder[0]!
	);
	expect({ proposal: input.proposal, data: input.data }).toEqual(before);
}
async function assertNonvisual() {
	const { service, input, deps } = fixture([]);
	const result = await service.prepare(input);
	expect(deps.preparePage).not.toHaveBeenCalled();
	expect(deps.admit).not.toHaveBeenCalled();
	expect(deps.finalize).toHaveBeenCalledExactlyOnceWith({ sourceCommit, pages: [] }, input.signal);
	expect(deps.verify).toHaveBeenCalledOnce();
	expect(deps.draft).toHaveBeenCalledOnce();
	expect(result.pages).toEqual([]);
}
function configureCancellation(
	kind: string,
	state: Pick<ReturnType<typeof fixture>, 'deps' | 'controller'>
) {
	const { deps, controller } = state;
	if (kind === 'cancelled') controller.abort();
	if (kind === 'mid-cancel')
		deps.preparePage.mockImplementation(async ({ module }) => {
			controller.abort();
			return page(module);
		});
}

async function assertRefusals() {
	for (const kind of [
		'discovery',
		'page',
		'admission',
		'finalize',
		'coverage',
		'cancelled',
		'mid-cancel'
	]) {
		const { service, input, deps, controller } = fixture(['page.checkout']);
		const failure = new Error(`Synthetic ${kind} refusal`);
		if (kind === 'discovery')
			deps.discover.mockReturnValue({
				valid: false,
				affectedPages: [],
				errors: ['Unresolved reference']
			});
		if (kind === 'page') deps.preparePage.mockRejectedValue(failure);
		if (kind === 'admission') deps.admit.mockRejectedValue(failure);
		if (kind === 'finalize') deps.finalize.mockRejectedValue(failure);
		if (kind === 'coverage')
			deps.verify.mockReturnValue({
				valid: false,
				affectedPages: [],
				missingPages: [],
				errors: ['Missing page design']
			});
		configureCancellation(kind, { deps, controller });
		await expect(service.prepare(input), kind).rejects.toThrow();
		expect(deps.draft, kind).not.toHaveBeenCalled();
		if (['discovery', 'cancelled'].includes(kind))
			expect(deps.preparePage, kind).not.toHaveBeenCalled();
		if (['discovery', 'page', 'admission', 'cancelled', 'mid-cancel'].includes(kind))
			expect(deps.finalize, kind).not.toHaveBeenCalled();
	}
}
async function assertIncompleteDesigns() {
	for (const kind of [
		'empty',
		'short',
		'no-preference',
		'two-preferences',
		'selected',
		'wrong-page',
		'invalid-hash',
		'duplicate-option'
	]) {
		const { service, input, deps } = fixture(['page.checkout']);
		const design = page('page.checkout');
		if (kind === 'empty') design.options = [];
		if (kind === 'short') design.options.pop();
		if (kind === 'no-preference') design.options[0].preferred = false;
		if (kind === 'two-preferences') design.options[1].preferred = true;
		if (kind === 'selected') design.selected = design.options[0].id;
		if (kind === 'wrong-page') design.module = 'page.foreign';
		if (kind === 'invalid-hash') design.options[0].sha256 = 'bad';
		if (kind === 'duplicate-option') design.options[1].id = design.options[0].id;
		deps.preparePage.mockResolvedValue(design);
		await expect(service.prepare(input), kind).rejects.toThrow();
		expect(deps.draft, kind).not.toHaveBeenCalled();
	}
}
test('FeaturePlanPreparationService.run from default initialization returns the file name', async () => {
	expect(new FeaturePlanPreparationService().run()).toBe('feature-plan-preparation');
	await assertPreparedPages(['page.orders', 'page.checkout', 'page.orders']);
	await assertPreparedPages(['page.orders', 'page.receipt', 'page.checkout']);
	await assertNonvisual();
	await assertRefusals();
	await assertIncompleteDesigns();
});
