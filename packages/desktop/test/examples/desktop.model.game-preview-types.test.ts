import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { GamePreviewProps } from '../../src/models/game-authoring/GamePreview.types';

test('accepts a valid game preview configuration', () => {
	const preview: GamePreviewProps = {
		view: {} as GamePreviewProps['view'],
		projectId: 'example-project',
		onRun: () => undefined
	};

	expect(preview.projectId).toBe('example-project');
	expect(preview.readonly).toBeUndefined();

	recordExampleCases(
		{
			unitId: 'desktop.model.game-preview-types',
			symbol: 'GamePreviewProps',
			state: 'accepts-a-valid-game-preview-configuration',
			evidence: 'examples-cases',
			file: 'accepts-a-valid-game-preview-configuration.json'
		},
		[
			{
				name: 'preview with required project and run handler',
				input: { projectId: 'example-project', readonly: undefined },
				output: { projectId: preview.projectId, readonly: preview.readonly }
			}
		]
	);
});
