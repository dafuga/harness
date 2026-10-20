import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { designDirections } from '../../src/utils/plan-design/designDirections';

/** Every count from 1 to 10 has as many directions, each unlike the others, the first the plainest. */
test('each count has its own number of distinct directions', () => {
	for (let count = 1; count <= 10; count++) {
		const directions = designDirections(count);
		expect([directions.length, new Set(directions).size]).toEqual([count, count]);
	}
	expect(designDirections(3)[0]).toMatch(/most directly/);
});
