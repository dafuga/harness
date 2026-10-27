import { expect, test, vi } from 'vitest';
import { FeaturePlanPreparationService } from '../../../src/services/agents-providers/FeaturePlanPreparationService';
import {
	sourceCommit,
	finalCommit,
	proposal,
	generatedPage,
	page,
	fixture,
	preparationFixture,
	assertNonvisual,
	configureCancellation
} from './feature-plan-preparation.test.fixtures';

async function assertPreparedPages(ids: string[]) {
	const { deps, input, service } = preparationFixture(ids);
	const before = structuredClone({ proposal: input.proposal, data: input.data });
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	deps.preparePage.mockImplementation(async ({ module }) => {
		await gate;
		return generatedPage(module);
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
	const generated = unique.map(generatedPage),
		pages = unique.map(page);
	expect(deps.discover).toHaveBeenCalledExactlyOnceWith(
		{ sourceCommit, changes: proposal.changes },
		input.data
	);
	for (const module of unique) {
		const design = input.pageDesigns!.find((item) => item.module === module)!;
		expect(deps.preparePage).toHaveBeenCalledWith({
			module,
			moduleGoal: `Implement the ${module} module.`,
			options: design.options,
			sourceCommit,
			count: 3,
			goal: proposal.goal,
			tldr: proposal.tldr,
			originalRequest: input.originalRequest,
			reference: design.reference,
			region: design.region,
			imagePrompt: [
				`Overall goal: ${proposal.goal}`,
				`Feature TLDR: ${proposal.tldr}`,
				`Page module: ${module}`,
				`Module goal: Implement the ${module} module.`,
				`User request: ${input.originalRequest}`,
				'Use the exact committed reference image as the GPT Image edit input.',
				`Edit only normalized region x=${design.region!.x}, y=${design.region!.y}, width=${design.region!.width}, height=${design.region!.height}. Preserve everything outside it, including layout, text, spacing, colors, navigation and other panels.`
			].join('\n'),
			signal: input.signal
		});
	}
	expect(deps.finalize).toHaveBeenCalledExactlyOnceWith(
		{ sourceCommit, pages: generated, designs: input.pageDesigns },
		input.signal
	);
	const draft = { ...input.proposal, sourceCommit: finalCommit, pages };
	expect(deps.verify).toHaveBeenCalledExactlyOnceWith(draft, { commit: finalCommit });
	expect(deps.draft).toHaveBeenCalledExactlyOnceWith(draft);
	expect(result).toEqual({ ...draft, revision: 1, digest: 'd'.repeat(64) });
	expect(result).not.toHaveProperty('approval');
	expect(result.pages.every((item) => item.selected === undefined)).toBe(true);
	expect(deps.verify.mock.invocationCallOrder[0]).toBeGreaterThan(
		deps.finalize.mock.invocationCallOrder[0]
	);
	expect(deps.draft.mock.invocationCallOrder[0]).toBeGreaterThan(
		deps.verify.mock.invocationCallOrder[0]
	);
	expect({ proposal: input.proposal, data: input.data }).toEqual(before);
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
		const { service, input, deps, controller } = preparationFixture(['page.checkout']);
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
		'duplicate-option',
		'missing-direction',
		'missing-prompt',
		'empty-image',
		'missing-choices',
		'duplicate-choice',
		'two-preferred-choices',
		'missing-reference',
		'duplicate-reference',
		'invalid-reference-hash',
		'invalid-region',
		'missing-request'
	]) {
		const { service, input, deps } = preparationFixture(['page.checkout']);
		const design = generatedPage('page.checkout');
		if (kind === 'empty') design.options = [];
		if (kind === 'short') design.options.pop();
		if (kind === 'no-preference') design.options[0].preferred = false;
		if (kind === 'two-preferences') design.options[1].preferred = true;
		if (kind === 'missing-direction') design.options[0].direction = '';
		if (kind === 'missing-prompt') design.options[0].prompt = '';
		if (kind === 'empty-image') design.options[0].bytes = new Uint8Array();
		if (kind === 'duplicate-option') design.options[1].id = design.options[0].id;
		if (kind === 'missing-reference') input.pageDesigns = [];
		if (kind === 'duplicate-reference') input.pageDesigns!.push(input.pageDesigns![0]);
		if (kind === 'missing-choices') input.pageDesigns![0].options = [];
		if (kind === 'duplicate-choice') input.pageDesigns![0].options[1].id = input.pageDesigns![0].options[0].id;
		if (kind === 'two-preferred-choices') input.pageDesigns![0].options[1].preferred = true;
		if (kind === 'invalid-reference-hash') input.pageDesigns![0].reference.sha256 = 'bad';
		if (kind === 'invalid-region') input.pageDesigns![0].region = { x: 0.8, y: 0, width: 0.3, height: 1 };
		if (kind === 'missing-request') input.originalRequest = '';
		deps.preparePage.mockResolvedValue(design);
		if (kind === 'selected' || kind === 'wrong-page' || kind === 'invalid-hash') {
			const finalized = page('page.checkout');
			if (kind === 'selected') finalized.selected = finalized.options[0]!.id;
			if (kind === 'wrong-page') finalized.module = 'page.foreign';
			if (kind === 'invalid-hash') finalized.options[0]!.sha256 = 'bad';
			deps.finalize.mockResolvedValueOnce({
				sourceCommit: finalCommit,
				data: { commit: finalCommit } as FeaturePlanPreparationInput['data'],
				pages: [finalized]
			});
		}
		await expect(service.prepare(input), kind).rejects.toThrow();
		expect(deps.draft, kind).not.toHaveBeenCalled();
	}
}

async function assertAdmittedWorkSettles() {
	const { service, input, deps } = preparationFixture(['page.first', 'page.second']);
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	deps.preparePage.mockImplementation(async ({ module }) => {
		if (module === 'page.first') throw new Error('First page failed');
		await gate;
			return generatedPage(module);
	});
	let settled = false;
	const pending = service.prepare(input).then(
		() => {
			settled = true;
			return null;
		},
		(error: unknown) => {
			settled = true;
			return error;
		}
	);
	try {
		await vi.waitFor(() => expect(deps.preparePage).toHaveBeenCalledTimes(2));
		expect(settled).toBe(false);
		expect(deps.finalize).not.toHaveBeenCalled();
	} finally {
		release();
	}
	expect(await pending).toMatchObject({ message: 'First page failed' });
	expect(deps.draft).not.toHaveBeenCalled();
}
test('prepare drafts only after every affected page design is committed and coverage is complete', async () => {
	await assertPreparedPages(['page.orders', 'page.checkout', 'page.orders']);
	await assertPreparedPages(['page.orders', 'page.receipt', 'page.checkout']);
	await assertNonvisual();
	await assertRefusals();
	await assertIncompleteDesigns();
	await assertAdmittedWorkSettles();
});
