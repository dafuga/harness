import { expect, test } from 'vitest';
import { frameTooLarge } from '../../src/utils/frameTooLarge';

const limit = 262144;

test('frameTooLarge allows a frame of exactly the contract limit', () => {
	expect(frameTooLarge('ping')).toBe(false);
	expect(frameTooLarge('x'.repeat(limit))).toBe(false);
	expect(frameTooLarge('x'.repeat(limit + 1))).toBe(true);
});

test('frameTooLarge counts UTF-8 bytes, not characters', () => {
	expect(frameTooLarge('é'.repeat(limit / 2))).toBe(false);
	expect(frameTooLarge('é'.repeat(limit / 2 + 1))).toBe(true);
	expect(frameTooLarge('€'.repeat(Math.ceil(limit / 3) + 1))).toBe(true);
});

test('frameTooLarge measures a binary frame by its length', () => {
	expect(frameTooLarge(new ArrayBuffer(limit))).toBe(false);
	expect(frameTooLarge(new ArrayBuffer(limit + 1))).toBe(true);
});

test('frameTooLarge takes another limit', () => {
	expect(frameTooLarge('abc', 3)).toBe(false);
	expect(frameTooLarge('abcd', 3)).toBe(true);
});
