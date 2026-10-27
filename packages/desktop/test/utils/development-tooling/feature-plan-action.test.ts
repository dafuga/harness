import { expect, test } from 'vitest';
import { featurePlanAction } from '../../../src/utils/development-tooling/featurePlanAction';

test('featurePlanAction trims padded text input', () => {
	// => 'value'
	expect(featurePlanAction(' value ')).toBe('value');
});

test('featurePlanAction with null input throws TypeError', () => {
	// throws TypeError
	expect(() => featurePlanAction(null as never)).toThrow(TypeError);
});

test('featurePlanAction with undefined input throws TypeError', () => {
	// throws TypeError
	expect(() => featurePlanAction(undefined as never)).toThrow(TypeError);
});
