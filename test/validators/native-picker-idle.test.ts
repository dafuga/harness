import { expect, test } from 'vitest';
import { NativePickerIdleValidator } from '../../src/validators/NativePickerIdleValidator';

test('an interrupted turn is not silently resumed as recovery', async () => {
	const result = await new NativePickerIdleValidator().validate(
		{ id: 't', status: { type: 'systemError' } },
		async () => ({ thread: { turns: [{ status: 'interrupted' }] } })
	);
	expect(result.valid).toBe(false);
});
