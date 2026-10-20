import type { ScaffoldDetail } from './scaffoldDetailTypes';
const entry = (kind: ScaffoldDetail['kind'], summary: string): ScaffoldDetail => ({
	kind,
	summary,
	appOnly: true,
	contains: [summary],
	exampleCommand: 'harness generate ' + kind + ' example'
});
export const gameScaffoldDetails = {
	'game-view': entry('game-view', 'Game scene, UI and visual direction.'),
	mechanic: entry('mechanic', 'Independent deterministic state/input/event behavior.'),
	checkpoint: entry('checkpoint', 'Executable condition/action checkpoint.')
};
