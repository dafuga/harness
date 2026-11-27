import { expect, test } from 'vitest';
import { trackerPlanning } from '../../../src/utils/projects-sessions/trackerPlanning';

test('projects valid planning records and ignores malformed historical values', () => {
	expect(
		trackerPlanning({
			planning_artifact_idea: '{"summary":"A planning tool"}',
			planning_artifact_detail: '{"links":[{"label":"Invalid","url":"file:///tmp/image.png"}]}',
			planning_promotion_detail: '{"by":"planner","at":"2026-11-24T12:00:00.000Z"}',
			planning_promotion_design: '{invalid'
		})
	).toEqual({
		artifacts: { idea: { summary: 'A planning tool' } },
		promotions: [{ stage: 'detail', by: 'planner', at: '2026-11-24T12:00:00.000Z' }]
	});
});
