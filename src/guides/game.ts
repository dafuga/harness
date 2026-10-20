import type { Guide } from './guide';
export const gameGuide: Guide = {
	topic: 'game',
	summary: 'Create 2D or 3D games with independent mechanics and executable checkpoint graphs.',
	steps: [
		'Create a game project and choose its dimension.',
		'Open the project in the desktop workspace and select Game Views.',
		'Edit graph conditions, consequences and AI guidance; save game.json.',
		'Implement mechanics against shared state/input/event contracts.'
	],
	rules: [
		'Game projects retain app generators and pages.',
		'The deterministic runtime owns outcomes; AI transforms appearance only.',
		'AI preview is disabled pending a credential-safe transport; prepared sessions cap at 60 seconds.',
		'Set HARNESS_GAME_DECART_API_KEY in the project-owned ignored .env.local; never commit it.'
	],
	antiPatterns: [
		'Do not use generated pixels as game state.',
		'Do not put arbitrary code in checkpoint data.'
	],
	exampleCommands: [
		'harness new game adventure --dimension 3d',
		'harness generate game-view courtyard',
		'harness generate mechanic movement',
		'harness generate checkpoint unlock-door'
	]
};
