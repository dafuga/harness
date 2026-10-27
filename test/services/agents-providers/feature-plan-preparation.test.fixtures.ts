import { expect, vi } from 'vitest';
import { FeaturePlanPreparationService } from '../../../src/services/agents-providers/FeaturePlanPreparationService';
import type {
	FeaturePlanPreparationInput,
	FeaturePlanProposal,
	GeneratedPage
} from '../../../src/services/agents-providers/FeaturePlanPreparationService.types';
import type { FeaturePlan } from '../../../src/repositories/agents-providers/ModuleTaskRepository.types';
import type { ModuleData } from '../../../src/services/git-source-history/ModuleDataService.types';
export const sourceCommit = 'a'.repeat(40);
export const finalCommit = 'f'.repeat(40);
const data = { commit: sourceCommit };
export const proposal = {
	feature: 'checkout',
	sourceCommit,
	goal: 'Review checkout',
	tldr: 'Build checkout',
	changes: [
		{
			unit: 'service.checkout',
			kind: 'modify' as const,
			assignedFiles: ['src/checkout.ts'],
			wantedContract: {
				responsibility: 'Validate checkout',
				inputs: [],
				outputs: [{ name: 'receipt', type: 'string' }],
				errors: []
			}
		}
	],
	tasks: []
};
export function page(module: string): FeaturePlan['pages'][number] {
	return {
		module,
		options: [0, 1, 2].map((index) => ({
			id: `option-${index}`,
			version: `${module}-v${index}`,
			commit: String(index + 1).repeat(40),
			path: `design/${module}/${index}.png`,
			sha256: String(index + 1).repeat(64),
			preferred: index === 0
		}))
	};
}
export function generatedPage(module: string): GeneratedPage {
	return {
		module,
		options: [0, 1, 2].map((index) => ({
			id: `o${index + 1}`,
			preferred: index === 0,
			direction: `Direction ${index + 1}`,
			prompt: `Prompt ${index + 1}`,
			revisedPrompt: null,
			bytes: new Uint8Array([index + 1])
		}))
	};
}
function collaborators(ids = ['page.orders', 'page.checkout', 'page.orders']) {
	return {
		discover: vi.fn((_input: unknown, _data: unknown) => ({
			valid: true,
			affectedPages: ids,
			errors: [] as string[]
		})),
		preparePage: vi.fn(async (input: { module: string }) => generatedPage(input.module)),
		admit: vi.fn(async <T>(action: () => Promise<T>) => action()),
		finalize: vi.fn(async (input: { pages: GeneratedPage[] }, _signal: AbortSignal) => ({
			sourceCommit: finalCommit,
			data: { commit: finalCommit },
			pages: input.pages.map(({ module }) => page(module))
		})),
		verify: vi.fn((_plan: unknown, _data: unknown) => ({
			valid: true,
			affectedPages: ids,
			missingPages: [],
			errors: [] as string[]
		})),
		draft: vi.fn(
			async (
				plan: Omit<FeaturePlan, 'revision' | 'digest' | 'approval'>
			): Promise<FeaturePlan> => ({ ...plan, revision: 1, digest: 'd'.repeat(64) })
		)
	};
}
const Service = FeaturePlanPreparationService as unknown as new (
	deps: ReturnType<typeof collaborators>
) => {
	prepare(input: FeaturePlanPreparationInput): Promise<FeaturePlan>;
};
export function fixture(ids?: string[]) {
	const deps = collaborators(ids);
	const controller = new AbortController();
	const input: FeaturePlanPreparationInput = {
		proposal: structuredClone(proposal) as FeaturePlanProposal,
		data: structuredClone(data) as ModuleData,
		originalRequest: 'Prepare a checkout feature plan.',
		pageDesigns: [],
		signal: controller.signal
	};
	return { deps, input, controller, service: new Service(deps) };
}

export function preparationFixture(ids: string[]) {
	const state = fixture(ids),
		modules = [...new Set(ids)],
		region = { x: 0.62, y: 0.1, width: 0.36, height: 0.88 };
	state.input.originalRequest = 'Update only the right-side panel; preserve every other page area.';
	state.input.pageDesigns = modules.map((module) => ({
		module,
		reference: {
			kind: 'current',
			entityId: module,
			commit: sourceCommit,
			version: 'current-v1',
			state: 'ready',
			viewport: 'desktop',
			file: `designs/${module}.png`,
			sha256: 'a'.repeat(64)
		},
		region,
		options: [0, 1, 2].map((index) => ({
			id: `o${index + 1}`,
			preferred: index === 0,
			direction: `Direction ${index + 1}`,
			instruction: `Prompt ${index + 1}`
		}))
	}));
	const plan = state.input.proposal as FeaturePlanProposal;
	plan.tasks = [
		...plan.tasks,
		...modules.map((module, index) => ({
			id: `page-task-${index}`,
			title: `Implement ${module}`,
			feature: proposal.feature,
			module,
			moduleGoal: `Implement the ${module} module.`,
			instructions: `Implement ${module} from its committed wanted contract.`,
			wantedContract: {
				responsibility: `Implement ${module}.`,
				inputs: [],
				outputs: [{ name: 'result', type: 'committed implementation' }],
				errors: []
			}
		}))
	];
	if (!plan.tasks.length)
		plan.tasks = [
			{
				id: 'module-task',
				title: 'Implement checkout',
				feature: proposal.feature,
				module: 'service.checkout',
				moduleGoal: 'Implement the checkout service.',
				instructions: 'Implement checkout from its committed wanted contract.',
				wantedContract: {
					responsibility: 'Implement checkout.',
					inputs: [],
					outputs: [{ name: 'result', type: 'committed implementation' }],
					errors: []
				}
			}
		];
	return state;
}

export async function assertNonvisual() {
	const { service, input, deps } = preparationFixture([]),
		result = await service.prepare(input);
	expect(deps.preparePage).not.toHaveBeenCalled();
	expect(deps.admit).not.toHaveBeenCalled();
	expect(deps.finalize).toHaveBeenCalledExactlyOnceWith(
		{ sourceCommit, pages: [], designs: [] },
		input.signal
	);
	expect(deps.verify).toHaveBeenCalledOnce();
	expect(deps.draft).toHaveBeenCalledOnce();
	expect(result.pages).toEqual([]);
}

export function configureCancellation(
	kind: string,
	state: Pick<ReturnType<typeof fixture>, 'deps' | 'controller'>
) {
	const { deps, controller } = state;
	if (kind === 'cancelled') controller.abort();
	if (kind === 'mid-cancel')
		deps.preparePage.mockImplementation(async ({ module }) => {
			controller.abort();
			return generatedPage(module);
		});
}
