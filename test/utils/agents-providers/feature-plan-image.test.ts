import { expect, test } from 'vitest';
import { featurePlanImage } from '../../../src/utils/agents-providers/featurePlanImage';

test('featurePlanImage trims padded text input', () => {
	// => 'value'
	expect(featurePlanImage(' value ')).toBe('value');
});

test('featurePlanImage with null input throws TypeError', () => {
	// throws TypeError
	expect(() => featurePlanImage(null as never)).toThrow(TypeError);
});

test('featurePlanImage with undefined input throws TypeError', () => {
	// throws TypeError
	expect(() => featurePlanImage(undefined as never)).toThrow(TypeError);
});
