import { expect, test } from 'vitest';
import { measureWorkload } from '../../../../../test/support/measureWorkload';
import { exampleDocument } from '../../../../game/src/utils/game-authoring/keyDoor';
import { gameWorkspaceSection } from '../../../src/components/game-authoring/game-workspace/gameWorkspaceSection';

test('workspace sections retain requested tabs except when the level plan requires its editor', () =>
	measureWorkload(
		'desktop.function.game-authoring-game-workspace-section',
		'level-plan-sections',
		() => {
			const view = exampleDocument().views[0];
			expect(gameWorkspaceSection(undefined, 'Level')).toBe('Checkpoints');
			expect(gameWorkspaceSection(view, 'Checkpoints')).toBe('Checkpoints');
			view.planning = { concept: 'Island', description: 'Reach the lantern' };
			expect(gameWorkspaceSection(view, 'Checkpoints')).toBe('Level');
			expect(gameWorkspaceSection(view, 'Mechanics')).toBe('Mechanics');
			expect(gameWorkspaceSection(view, 'Level')).toBe('Level');
			const failure = new Error('Plan unavailable');
			Object.defineProperty(view, 'planning', {
				get: () => {
					throw failure;
				}
			});
			expect(() => gameWorkspaceSection(view, 'Level')).toThrow(failure);
		}
	));
