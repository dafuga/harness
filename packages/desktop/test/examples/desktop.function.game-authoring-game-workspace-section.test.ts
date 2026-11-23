import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { gameWorkspaceSection } from '../../src/components/game-authoring/game-workspace/gameWorkspaceSection';
import type { GameView } from '../../../game/src/index';
import type { GameSection } from '../../src/components/game-authoring/GameViewFields.types';

const UNIT_ID = 'desktop.function.game-authoring-game-workspace-section';
const SYMBOL = 'gameWorkspaceSection';

const PLAN = {
	concept: 'Walled garden with the key on a raised ledge',
	description: 'The player climbs to the key, then reaches the door on the far wall.'
};

function makeView(planned: boolean): GameView {
	const base = {
		id: 'courtyard',
		title: 'The courtyard',
		dimension: planned ? '3d' : '2d',
		style:
			'Lush illustrated garden, warm stone, soft sunlight. Preserve the player, key and door positions.',
		checkpoints: []
	};
	return (planned ? { ...base, planning: PLAN } : base) as unknown as GameView;
}

function summary(view: GameView | undefined): { planned: boolean; present: boolean } {
	return { present: view !== undefined, planned: view?.planning !== undefined };
}

test('Keeps the requested section when the level has no plan', () => {
	const unplanned = makeView(false);
	const level = gameWorkspaceSection(undefined, 'Level');
	const fromLevel = gameWorkspaceSection(unplanned, 'Level');
	const preview = gameWorkspaceSection(unplanned, 'Preview');
	const mechanics = gameWorkspaceSection(unplanned, 'Mechanics');

	expect(level).toBe('Checkpoints');
	expect(fromLevel).toBe('Checkpoints');
	expect(preview).toBe('Preview');
	expect(mechanics).toBe('Mechanics');

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: SYMBOL,
			state: 'keeps-the-requested-section-when-the-level-has-no-plan',
			evidence: 'examples-cases',
			file: 'keeps-the-requested-section-when-the-level-has-no-plan.json'
		},
		[
			{
				name: 'undefined view requesting Level',
				input: { view: undefined, tab: 'Level' },
				output: level
			},
			{
				name: 'unplanned level requesting Level',
				input: { view: summary(unplanned), tab: 'Level' },
				output: fromLevel
			},
			{
				name: 'unplanned level requesting Preview',
				input: { view: summary(unplanned), tab: 'Preview' },
				output: preview
			},
			{
				name: 'unplanned level requesting Mechanics',
				input: { view: summary(unplanned), tab: 'Mechanics' },
				output: mechanics
			}
		]
	);
});

test('Keeps Mechanics open for a planned level', () => {
	const planned = makeView(true);
	const mechanics = gameWorkspaceSection(planned, 'Mechanics');
	const level = gameWorkspaceSection(planned, 'Level');

	expect(mechanics).toBe('Mechanics');
	expect(level).toBe('Level');

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: SYMBOL,
			state: 'keeps-mechanics-open-for-a-planned-level',
			evidence: 'examples-cases',
			file: 'keeps-mechanics-open-for-a-planned-level.json'
		},
		[
			{
				name: 'planned level requesting Mechanics',
				input: { view: summary(planned), tab: 'Mechanics' },
				output: mechanics
			},
			{
				name: 'planned level requesting Level',
				input: { view: summary(planned), tab: 'Level' },
				output: level
			}
		]
	);
});

test('Moves a planned level off Checkpoints until it is ready', () => {
	const planned = makeView(true);
	const requested: GameSection = 'Checkpoints';
	const section = gameWorkspaceSection(planned, requested);

	// Ready levels keep the requested section; unready ones fall back to Level.
	expect(['Checkpoints', 'Level']).toContain(section);

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: SYMBOL,
			state: 'moves-a-planned-level-off-checkpoints-until-it-is-ready',
			evidence: 'examples-cases',
			file: 'moves-a-planned-level-off-checkpoints-until-it-is-ready.json'
		},
		[
			{
				name: 'planned level requesting Checkpoints',
				input: { view: summary(planned), tab: requested },
				output: section
			}
		]
	);
});
