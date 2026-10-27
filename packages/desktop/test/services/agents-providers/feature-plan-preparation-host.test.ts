import { expect, test } from 'vitest';
import { FeaturePlanPreparationHostService } from '../../../src/services/agents-providers/FeaturePlanPreparationHostService';

test('FeaturePlanPreparationHostService.run from default initialization returns the file name', () => {
	// => 'feature-plan-preparation-host'
	expect(new FeaturePlanPreparationHostService().run()).toBe('feature-plan-preparation-host');
});
