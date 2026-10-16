import { expect } from '../../../../test/verificationExpect';
import { Buffer } from 'node:buffer';
import { test } from 'vitest';
import { PNG } from 'pngjs';
import { planImageCodec } from '../../src/utils/planImageCodec';
test('decodes complete PNG and rejects damaged compressed image content', () => {
	const bytes = PNG.sync.write(new PNG({ width: 2, height: 2 }));
	expect(planImageCodec(bytes)).toEqual({ width: 2, height: 2 });
	const corrupt = Buffer.from(bytes);
	corrupt[corrupt.length - 16] ^= 255;
	expect(() => planImageCodec(corrupt)).toThrow();
	expect(() => planImageCodec(bytes.subarray(0, 33))).toThrow();
});
