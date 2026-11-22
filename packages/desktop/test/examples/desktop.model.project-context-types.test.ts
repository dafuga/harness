import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { ProjectContext } from '../../src/models/projects-sessions/ProjectContext.types';

test('accepts an omitted or selected project context', () => {
	const selected: ProjectContext = { projectId: 'project-example' };
	const omitted: ProjectContext = {};

	expect(selected).toEqual({ projectId: 'project-example' });
	expect(omitted).toEqual({});

	recordExampleCases(
		{
			unitId: 'desktop.model.project-context-types',
			symbol: 'ProjectContext',
			state: 'accepts-an-omitted-or-selected-project-context',
			evidence: 'examples-cases',
			file: 'accepts-an-omitted-or-selected-project-context.json'
		},
		[
			{ name: 'selected project context', input: { projectId: 'project-example' }, output: selected },
			{ name: 'omitted project context preserves selection behavior', input: {}, output: omitted }
		]
	);
});
