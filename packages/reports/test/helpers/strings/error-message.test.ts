import { expect, test } from 'vitest';
import { measureWorkload } from '../../../../../test/support/measureWorkload';
import { errorMessage } from '../../../src/helpers/strings/errorMessage';

test('errorMessage preserves error messages and stringifies thrown values', async () => {
	await measureWorkload('reports.helper.strings-error-message', 'thrown-values', () => {
		for (const [cause, message] of [
			[new Error('File unavailable'), 'File unavailable'],
			['  detail  ', '  detail  '],
			[null, 'null'],
			[undefined, 'undefined'],
			[42, '42']
		] as const)
			expect(errorMessage(cause)).toBe(message);
	});
});
