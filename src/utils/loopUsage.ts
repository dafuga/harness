import type { LoopUsage } from '../core/activityTypes';
import type { LoopState } from '../workflows/loopState';

const shown = 5;

/**
 * How often each loop type was used and how those loops ended. A loop is complete when every
 * step of it is; a loop that names no template is `custom`. The most used type comes first.
 */
export function loopUsage(loops: LoopState[]): { total: number; types: LoopUsage[] } {
	const types = new Map<string, LoopState[]>();
	for (const loop of loops) {
		const template = loop.template ?? 'custom';
		types.set(template, [...(types.get(template) ?? []), loop]);
	}
	const usage = [...types].map(([template, used]) => {
		const latest = [...used].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
		const complete = used.filter(
			(loop) => loop.steps.length > 0 && loop.steps.every((step) => step.status === 'complete')
		).length;
		return {
			template,
			loops: used.length,
			complete,
			open: used.length - complete,
			lastUsedAt: latest[0].updatedAt,
			names: latest.slice(0, shown).map((loop) => loop.name)
		};
	});
	usage.sort(
		(left, right) => right.loops - left.loops || left.template.localeCompare(right.template)
	);
	return { total: loops.length, types: usage };
}
