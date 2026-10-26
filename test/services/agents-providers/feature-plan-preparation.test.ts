import { expect, test } from 'vitest';
import { FeaturePlanPreparationService } from '../../../src/services/agents-providers/FeaturePlanPreparationService';

test('FeaturePlanPreparationService.run from default initialization returns the file name', () => {
	// => 'feature-plan-preparation'
	expect(new FeaturePlanPreparationService().run()).toBe('feature-plan-preparation');
});
