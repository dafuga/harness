import { expect, test } from 'vitest';
import {
	projectModulePlanSchema,
	projectModuleProgress,
	projectModuleProgressLabel
} from '../../../src/helpers/projects-sessions/projectModuleProgress';

test('projectModuleProgress reports an independently counted built and in-progress segment', () => {
	const modules = [
		{ id: 'deployed', state: 'live', release: 'first' },
		{ id: 'accepted', state: 'built', release: 'later' },
		{ id: 'started', state: 'in_progress', release: 'first' },
		{ id: 'future', state: 'planned', release: 'later' }
	];
	const plan = projectModulePlanSchema.parse({ state: 'available', modules });
	expect(projectModuleProgress(plan, 'full')).toEqual({
		built: 2,
		inProgress: 1,
		total: 4,
		percent: 50
	});
	expect(projectModuleProgress(plan, 'first')).toEqual({
		built: 1,
		inProgress: 1,
		total: 2,
		percent: 50
	});
	expect(projectModuleProgressLabel(plan, 'full')).toBe('2 of 4 modules built (50%)');
	expect(projectModuleProgressLabel({ state: 'review' }, 'full')).toBe(
		'Module plan awaiting review'
	);
	expect(projectModuleProgressLabel({ state: 'unavailable' }, 'full')).toBe(
		'Module plan unavailable'
	);
	expect(projectModulePlanSchema.safeParse({ state: 'available', modules: [] }).success).toBe(
		false
	);
	expect(
		projectModulePlanSchema.safeParse({ state: 'available', modules: [...modules, modules[0]] })
			.success
	).toBe(false);
});
