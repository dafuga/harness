import { expect, test } from 'vitest';
import { featurePlanImpact } from '../../../src/utils/agents-providers/featurePlanImpact';

test('featurePlanImpact trims padded text input', () => {
	// => 'value'
	expect(featurePlanImpact(' value ')).toBe('value');
});

test('featurePlanImpact with null input throws TypeError', () => {
	// throws TypeError
	expect(() => featurePlanImpact(null as never)).toThrow(TypeError);
});

test('featurePlanImpact with undefined input throws TypeError', () => {
	// throws TypeError
	expect(() => featurePlanImpact(undefined as never)).toThrow(TypeError);
});
