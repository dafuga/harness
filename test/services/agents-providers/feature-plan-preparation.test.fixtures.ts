import { vi } from 'vitest';
import { FeaturePlanPreparationService } from '../../../src/services/agents-providers/FeaturePlanPreparationService';
import type { FeaturePlan } from '../../../src/repositories/agents-providers/ModuleTaskRepository.types';
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
function collaborators(ids = ['page.orders', 'page.checkout', 'page.orders']) {
	return {
		discover: vi.fn((_input: unknown, _data: unknown) => ({
			valid: true,
			affectedPages: ids,
			errors: [] as string[]
		})),
		preparePage: vi.fn(
			async (input: { module: string; sourceCommit: string; count: number; signal: AbortSignal }) =>
				page(input.module)
		),
		admit: vi.fn(async <T>(action: () => Promise<T>) => action()),
		finalize: vi.fn(async (_input: unknown, _signal: AbortSignal) => ({
			sourceCommit: finalCommit,
			data: { commit: finalCommit }
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
	prepare(input: {
		proposal: typeof proposal;
		data: typeof data;
		signal: AbortSignal;
	}): Promise<FeaturePlan>;
};
export function fixture(ids?: string[]) {
	const deps = collaborators(ids);
	const controller = new AbortController();
	const input = {
		proposal: structuredClone(proposal),
		data: structuredClone(data),
		signal: controller.signal
	};
	return { deps, input, controller, service: new Service(deps) };
}
