import { expect, test } from 'vitest';
import { FeaturePlanService } from '../../../src/services/agents-providers/FeaturePlanService';

test('FeaturePlanService.run from default initialization returns the file name', () => {
	// => 'feature-plan'
	expect(new FeaturePlanService().run()).toBe('feature-plan');
});
