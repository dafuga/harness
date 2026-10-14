import { expect, test } from 'vitest';
import { hubPlanSchema, hubSchemas } from '../src/utils/hubSchemas';

/** A hosted project reads the plan of a shell as it reads every other plan. */
test('the hub reads the plan of a shell, and still refuses a category that does not exist', () => {
	const plan = {
		unitId: 'shell.host-frame',
		category: 'shell',
		slug: 'host-frame',
		title: 'Host frame',
		goal: 'Frames the workspace of a host.',
		path: 'src/shells/host-frame',
		createdAt: '2026-10-14T08:00:00.000Z',
		baseRevision: 'a'.repeat(40),
		contract: {
			responsibility: 'Frames the workspace of a host.',
			inputs: [],
			outputs: [],
			errors: [],
			states: ['default'],
			viewports: ['desktop']
		},
		contractHash: 'b'.repeat(64)
	};
	expect(hubSchemas(hubPlanSchema, plan).category).toBe('shell');
	expect(() => hubSchemas(hubPlanSchema, { ...plan, category: 'widget' })).toThrow();
});
