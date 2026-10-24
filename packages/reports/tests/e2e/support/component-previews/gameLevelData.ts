import { createRun, exampleDocument } from '../../../../../game/src/index';
import type { LevelLayout, LevelProposal } from '../../../../../game/src/index';
import type { PreviewCases } from './shared';
import { noop } from './shared';
const layout: LevelLayout = {
	width: 12,
	depth: 8,
	spawn: { x: 1, z: 1 },
	objects: [
		{
			id: 'stone-wall',
			kind: 'wall',
			label: 'Stone wall',
			x: 5,
			z: 4,
			width: 1,
			depth: 3,
			height: 2
		},
		{ id: 'lantern', kind: 'goal', label: 'Lantern', x: 10, z: 6, width: 1, depth: 1, height: 1 }
	]
};
const proposal: LevelProposal = {
	id: 'a'.repeat(64),
	concept: 'A lantern island',
	description: 'A quiet island with a wall and a lantern at the far shore.',
	dimension: '3d',
	provider: 'codex',
	model: 'synthetic-fixture',
	summary: 'Cross the island and reach the lantern.',
	layout
};
const document = exampleDocument('3d');
const view = {
	...document.views[0],
	checkpoints: [],
	planning: { concept: proposal.concept, description: proposal.description }
};
const providers = [
	{
		id: 'codex',
		label: 'Synthetic local provider',
		available: true,
		reason: null,
		version: 'fixture',
		imageGeneration: false,
		models: [
			{
				id: 'synthetic-fixture',
				label: 'Synthetic model',
				efforts: [],
				defaultEffort: null,
				isDefault: true
			}
		]
	}
];
const status = { busy: false, readonly: false, reason: '', error: '' };
const run = { ...createRun(), state: { ...createRun().state, x: 1, y: 1 } };
/** Dedicated synthetic component inputs; no inference, project reads or writes. */
export const gameLevelCases: PreviewCases = {
	'desktop.component.game-level-plan': {
		context: { view, document: { ...document, views: [view] }, readonly: false },
		run,
		change: noop
	},
	'desktop.component.game-level-brief': {
		step: 'brief',
		planning: view.planning,
		dimension: '3d',
		providers,
		provider: 'codex',
		model: 'synthetic-fixture',
		status,
		revise: noop,
		reshape: noop,
		generate: noop,
		go: noop
	},
	'desktop.component.game-level-review': {
		proposal,
		providers,
		status,
		regenerate: noop,
		approve: noop,
		build: noop,
		edit: noop
	},
	'desktop.component.game-level-preview': {
		layout,
		dimension: '3d',
		label: 'Generated island preview'
	},
	'desktop.component.game-controls': {
		view: { ...view, world: layout },
		run,
		step: noop,
		reset: noop
	}
};
