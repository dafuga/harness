import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { hash, planData } from '../../src/utils/planData';
test('canonical data ignores object insertion order but preserves array order', () => {
	expect(hash(planData({ b: 2, a: 1 }))).toBe(hash(planData({ a: 1, b: 2 })));
	expect(planData([2, 1])).not.toBe(planData([1, 2]));
});
