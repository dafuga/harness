import { resolveLoopTemplate } from '../../loopTemplates';
import { fail } from '../../../core/errors';
import type { LoopState } from '../../loop-state/loopState';

export async function newLoopState(
	root: string,
	input: {
		name: string;
		goal: string;
		createdAt: string;
		from?: string;
		kind?: 'coding' | 'planning';
		plan?: string;
	}
): Promise<LoopState> {
	const inherited = input.from ? await resolveLoopTemplate(root, input.from) : undefined;
	if (input.kind && !['coding', 'planning'].includes(input.kind))
		fail('Task kind must be coding or planning.');
	return {
		completion: completion(input, Boolean(inherited)),
		name: input.name,
		goal: input.goal,
		createdAt: input.createdAt,
		updatedAt: input.createdAt,
		...templateFields(inherited)
	};
}

function completion(
	input: { kind?: 'coding' | 'planning'; plan?: string },
	inherited: boolean
): LoopState['completion'] {
	if (!inherited && !input.kind) return undefined;
	return { version: 1, kind: input.kind ?? 'coding', plan: input.plan };
}

function templateFields(template: Awaited<ReturnType<typeof resolveLoopTemplate>> | undefined) {
	const regression = template?.lineage.some((id) =>
		['bug-fix', 'regression-prevention'].includes(id)
	);
	return {
		template: template?.id,
		templateLineage: template?.lineage,
		enforceOrder: regression,
		...(regression ? { regressionCommits: 1 as const } : {}),
		steps: template?.steps.map((step) => ({ ...step, status: 'pending' as const })) ?? [],
		evaluators: template?.evaluators
	};
}
