import { expect, test } from 'vitest';
import { planValidate, region } from '../../src/utils/planValidate';
test('identities and rectangles reject traversal and out-of-image coordinates', () => {
	expect(planValidate('function.filter')).toBe('src/functions/filter');
	expect(() => planValidate('function.../escape')).toThrow();
	expect(() => region({ x: 0.9, y: 0, width: 0.2, height: 1 })).toThrow();
	expect(region({ x: 0.123456789, y: 0, width: 0.2, height: 1 })?.x).toBe(0.123457);
});
