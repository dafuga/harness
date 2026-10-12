import { expect, test } from 'vitest';
import { hubContractHash, hubJson } from '../../src/utils/hubJson';
test('invalid committed JSON is explicit and equal contracts have canonical hashes', async () => {
	expect(() => hubJson(new TextEncoder().encode('broken'))).toThrow();
	expect(await hubContractHash({ a: 1, b: 2 })).toBe(await hubContractHash({ b: 2, a: 1 }));
});
