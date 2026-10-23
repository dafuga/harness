import type { ScaffoldDetail } from '../development-tooling/scaffoldDetailTypes';
const entry = (
	kind: ScaffoldDetail['kind'],
	summary: string,
	contains: string[]
): ScaffoldDetail => ({
	kind,
	summary,
	appOnly: true,
	gameOnly: true,
	contains,
	exampleCommand: 'harness generate ' + kind + ' example'
});
export const gameScaffoldDetails = {
	'game-view': entry('game-view', 'Game scene, UI and visual direction.', [
		'Game view config under src/configs/<name>ViewConfig.ts.',
		"View dimension taken from the project's harness.dimension."
	]),
	mechanic: entry('mechanic', 'Independent deterministic state/input/event behavior.', [
		'Mechanic function under src/utils/<name>.ts.',
		'Mechanic unit test under test/<name>.test.ts.'
	]),
	checkpoint: entry('checkpoint', 'Executable condition/action checkpoint.', [
		'Checkpoint config under src/configs/<name>CheckpointConfig.ts.'
	])
};
