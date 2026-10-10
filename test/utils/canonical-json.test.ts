import { expect, test } from 'vitest';
import { canonicalJson } from '../../src/utils/canonicalJson';

test('canonicalJson sorts keys at every depth and keeps array order', () => {
	const left = { b: [{ y: 1, x: 2 }, 3], a: { d: null, c: 'text' } };
	const right = { a: { c: 'text', d: null }, b: [{ x: 2, y: 1 }, 3] };
	expect(canonicalJson(left)).toBe(canonicalJson(right));
	expect(canonicalJson(left)).toBe('{"a":{"c":"text","d":null},"b":[{"x":2,"y":1},3]}');
	expect(canonicalJson({ b: [1, 2] })).not.toBe(canonicalJson({ b: [2, 1] }));
});

test('canonicalJson leaves out undefined fields, which JSON cannot carry', () => {
	expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
	expect(canonicalJson('plain')).toBe('"plain"');
});
