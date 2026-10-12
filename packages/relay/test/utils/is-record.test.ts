import { expect, test } from 'vitest';
import { isRecord } from '../../src/utils/isRecord';

test('isRecord accepts a JSON object', () => {
	expect(isRecord({})).toBe(true);
	expect(isRecord({ type: 'ack', ok: true })).toBe(true);
	expect(isRecord(Object.create(null))).toBe(true);
});

test('isRecord refuses every other JSON value', () => {
	for (const value of [null, undefined, [], [{}], 'text', '', 0, 7, true, false]) {
		expect(isRecord(value), JSON.stringify(value)).toBe(false);
	}
});
