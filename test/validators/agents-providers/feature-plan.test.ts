import { expect, test } from 'vitest';
import { FeaturePlanValidator } from '../../../src/validators/agents-providers/FeaturePlanValidator';

test('FeaturePlanValidator.validate from default initialization covers supported and invalid inputs', () => {
	const validator = new FeaturePlanValidator();
	// => { valid: true, errors: [] }
	expect(validator.validate({ title: 'value' })).toEqual({ valid: true, errors: [] });
	// => { valid: false, errors: ['input is empty'] }
	expect(validator.validate({})).toEqual({ valid: false, errors: ['input is empty'] });
	// throws TypeError
	expect(() => validator.validate(null as never)).toThrow(TypeError);
});
