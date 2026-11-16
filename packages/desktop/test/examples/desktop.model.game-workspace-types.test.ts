import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { GameWorkspaceProps } from '../../src/models/game-authoring/GameWorkspace.types';

test('accepts optional game workspace properties', () => {
	const empty = {} satisfies GameWorkspaceProps;
	const configured = {
		projectId: 'project-example',
		commit: 'main',
		readonly: true
	} satisfies GameWorkspaceProps;
	const nullableProject = { projectId: null } satisfies GameWorkspaceProps;

	expect(configured).toEqual({
		projectId: 'project-example',
		commit: 'main',
		readonly: true
	});

	recordExampleCases(
		{
			unitId: 'desktop.model.game-workspace-types',
			symbol: 'GameWorkspaceProps',
			state: 'accepts-optional-game-workspace-properties',
			evidence: 'examples-cases',
			file: 'accepts-optional-game-workspace-properties.json'
		},
		[
			{ name: 'empty workspace options', input: {}, output: empty },
			{ name: 'configured workspace options', input: configured, output: configured },
			{ name: 'nullable project identifier', input: nullableProject, output: nullableProject }
		]
	);
});
