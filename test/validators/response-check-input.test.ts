import { expect, test } from 'vitest';
import { ResponseCheckInputValidator } from '../../src/validators/ResponseCheckInputValidator';
const validator = new ResponseCheckInputValidator();

test('normalizes criteria and supports ids colliding with standard names', () => {
	expect(
		validator.validateCriteria([{ id: ' fulfillment ', description: ' Return JSON. ' }])
	).toEqual([{ id: 'fulfillment', description: 'Return JSON.' }]);
});
test.each([
	null,
	{},
	[null],
	[1],
	[{ id: '', description: 'a' }],
	[{ id: 'a', description: ' ' }],
	[{ id: 1, description: 'a' }],
	[
		{ id: 'a', description: 'b' },
		{ id: ' a ', description: 'c' }
	]
])('rejects invalid criteria %j', (raw) => {
	expect(() => validator.validateCriteria(raw)).toThrow();
});
