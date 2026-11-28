// @harness-uid u_m5tmgubvzt
import { z } from 'zod';
import type { ProjectModuleMilestone, ProjectModulePlan } from './projectModuleProgress.types';

export const projectModuleStates = ['live', 'built', 'in_progress', 'planned'] as const;

export const projectModuleSchema = z.object({
	id: z
		.string()
		.regex(/^[a-z0-9][a-z0-9._-]*$/)
		.max(200),
	title: z.string().min(1).max(200).optional(),
	state: z.enum(projectModuleStates),
	release: z.enum(['first', 'later'])
});

export const projectModulePlanSchema = z.discriminatedUnion('state', [
	z.object({
		state: z.literal('available'),
		modules: z
			.array(projectModuleSchema)
			.min(1)
			.max(10_000)
			.refine((rows) => new Set(rows.map(({ id }) => id)).size === rows.length)
	}),
	z.object({ state: z.enum(['review', 'unavailable']) })
]);

export const projectModuleMilestones = [
	{ id: 'first', label: 'First release' },
	{ id: 'full', label: 'Full' }
] as const;

/** Built includes live modules. The in-progress segment is independent of the built count. */
export function projectModuleProgress(plan: ProjectModulePlan, milestone: ProjectModuleMilestone) {
	if (plan.state !== 'available') return null;
	const modules =
		milestone === 'first'
			? plan.modules.filter(({ release }) => release === 'first')
			: plan.modules;
	if (!modules.length) return null;
	const built = modules.filter(({ state }) => state === 'built' || state === 'live').length;
	const inProgress = modules.filter(({ state }) => state === 'in_progress').length;
	const total = modules.length;
	return {
		built,
		inProgress,
		total,
		percent: built === total ? 100 : Math.min(99, Math.round((built / total) * 100))
	};
}

export function projectModuleProgressLabel(
	plan: ProjectModulePlan,
	milestone: ProjectModuleMilestone
): string {
	const progress = projectModuleProgress(plan, milestone);
	if (!progress)
		return plan.state === 'review' ? 'Module plan awaiting review' : 'Module plan unavailable';
	const { built, total, percent } = progress;
	return `${built.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} modules built (${percent}%)`;
}

export function formatProjectModuleProgress(command: string, data: unknown) {
	if (command !== 'project-progress') return undefined;
	const { project, plan } = data as { project: string; plan: ProjectModulePlan };
	if (plan.state !== 'available') return `${project}: ${projectModuleProgressLabel(plan, 'full')}`;
	const summary = projectModuleMilestones.map(
		({ id, label }) => `${label}: ${projectModuleProgressLabel(plan, id)}`
	);
	return [project, ...summary].join('\n');
}
