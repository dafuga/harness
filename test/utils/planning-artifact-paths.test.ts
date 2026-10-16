import { expect, test } from 'vitest';
import { planningArtifactPaths } from '../../src/utils/planningArtifactPaths';

test('shape names alone cannot exempt files without validated on-disk metadata', () => {
	expect(
		planningArtifactPaths(undefined, [
			'src/pages/example/plan.json',
			'src/pages/example/designs/v001/code.ts'
		]).size
	).toBe(0);
});
