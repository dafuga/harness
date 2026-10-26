import { expect, test } from 'vitest';
import { FeatureWorkService } from '../../../src/services/agents-providers/FeatureWorkService';

test('FeatureWorkService.run from default initialization returns the file name', () => {
	// => 'feature-work'
	expect(new FeatureWorkService().run()).toBe('feature-work');
});
