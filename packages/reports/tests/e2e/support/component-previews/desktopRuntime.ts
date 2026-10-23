import { gameLevelCases } from './gameLevelData';
import { createRun, exampleDocument, stepGame } from '../../../../../game/src/index';
import type { DesktopCase } from './desktopData.svelte';
import { noop, type PreviewCases } from './shared';
const game = exampleDocument();
const view = game.views[0];
// One step that collects the key, so the trace, graph and preview each have a fired checkpoint.
const run = stepGame(createRun(), { x: 2.5, y: 0 }, view);
/** The game authoring components over the example game; nothing here reads or saves a project. */
export const gameCases: PreviewCases = {
	...gameLevelCases,
	'desktop.component.game-authoring-game-graph-fit': {},
	'desktop.component.game-checkpoint-editor': { checkpoint: view.checkpoints[1], change: noop },
	'desktop.component.game-checkpoint-image': {
		checkpoint: view.checkpoints[0],
		view,
		document: game,
		change: noop
	},
	'desktop.component.game-checkpoint-pane': {
		context: { checkpoint: view.checkpoints[0], view, document: game },
		change: noop
	},
	'desktop.component.game-create': {
		bridge: {
			gameCreate: async () => {
				throw new Error('Preview fixtures cannot create projects.');
			}
		},
		created: noop
	},
	'desktop.component.game-graph': {
		checkpoints: view.checkpoints,
		run,
		selected: 'door',
		select: noop,
		change: noop
	},
	'desktop.component.game-live-video': {},
	'desktop.component.game-mechanics': { mechanics: game.mechanics, change: noop },
	'desktop.component.game-navigation-guard': { active: true },
	'desktop.component.game-preview': { view, projectId: null, initialRun: run, onRun: noop },
	'desktop.component.game-text-field': { value: 'x, y, choice', label: 'Inputs', change: noop },
	'desktop.component.game-trace': { run, view },
	'desktop.component.game-view-fields': {
		section: 'Checkpoints',
		view,
		views: game.views,
		select: noop,
		create: noop,
		change: noop
	},
	'desktop.component.game-workspace': {}
};
export const desktopRuntime: Record<string, DesktopCase> = {
	'desktop.component.runtime-artifact': (d) => ({
		cell: d.cell,
		label: 'Recorded filter call',
		lost: false
	}),
	'desktop.component.runtime-audio': (d) => ({ result: d.audioResult, evidence: d.audioEvidence }),
	'desktop.component.runtime-behavior': (d) => ({ result: d.result, evidence: d.evidence }),
	'desktop.component.runtime-evidence': (d) => ({
		entity: d.visualEntity,
		workspace: d.workspace,
		evidence: d.visualEvidence
	}),
	'desktop.component.runtime-pane': (d) => ({
		item: d.item,
		title: 'Current screenshot',
		role: 'Branch tip',
		evidence: d.visualEvidence
	}),
	'desktop.component.runtime-run': (d) => ({
		shown: d.shown,
		side: 'after',
		title: 'Current results',
		role: 'Branch tip',
		lost: false,
		refusals: {}
	}),
	'desktop.component.runtime-screens': (d) => ({
		result: d.visual,
		options: d.options,
		evidence: d.visualEvidence
	})
};
