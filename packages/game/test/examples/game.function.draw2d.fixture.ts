import type { Run } from './game.function.draw2d.test.types';

export function run(state: Record<string, unknown>): Run {
	return {
		viewId: 'courtyard',
		progress: { courtyard: [] },
		tick: 2,
		seed: 67634689,
		state,
		completed: [],
		events: [],
		trace: []
	} as unknown as Run;
}
