import { expect, test } from 'vitest';
import { measureWorkload } from '../../../../../test/support/measureWorkload';
import { errorMessage } from '../../../src/helpers/strings/errorMessage';
import manifest from '../../../../../specification/units/reports.helper.strings-error-message.json';

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
		const conversionFailure = new Error('The thrown value cannot become text');
		const cause = {
			[Symbol.toPrimitive]() {
				throw conversionFailure;
			}
		};
		expect(() => errorMessage(cause)).toThrow(conversionFailure);
		const messageFailure = new Error('The message accessor failed');
		const error = Object.defineProperty(new Error('Unavailable'), 'message', {
			get() {
				throw messageFailure;
			}
		});
		expect(() => errorMessage(error)).toThrow(messageFailure);
		for (const contract of [manifest.contract, ...manifest.contract.operations]) {
			expect(contract.errors, 'errorMessage declares admitted conversion failures').toEqual(
				expect.arrayContaining([expect.objectContaining({ type: 'propagated' })])
			);
		}
	});
});
