import { expect, test } from 'vitest';
import { CodexRequestValidator } from '../../src/validators/CodexRequestValidator';

test('gateway validates actual Responses requests without accepting incompatible transports', () => {
	const validator = new CodexRequestValidator();
	expect(validator.parse({ model: 'claude-opus-5-5', stream: true, input: [] })).toMatchObject({
		stream: true
	});
	expect(() => validator.parse({ model: 'claude-opus-5-5', stream: false, input: [] })).toThrow();
	expect(() =>
		validator.parse({
			model: 'claude-opus-5-5',
			stream: true,
			input: [],
			previous_response_id: 'missing'
		})
	).toThrow();
});
