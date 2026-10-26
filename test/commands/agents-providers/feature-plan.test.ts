import { expect, test } from 'vitest';
import { FeaturePlanCommand } from '../../../src/commands/agents-providers/FeaturePlanCommand';

test('FeaturePlanCommand.run from default initialization returns the file name', () => {
	// => 'feature-plan'
	expect(new FeaturePlanCommand().run()).toBe('feature-plan');
});
