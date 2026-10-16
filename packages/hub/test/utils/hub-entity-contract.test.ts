import { expect, test } from 'vitest';
import { hubEntityContract } from '../../src/utils/hubEntityContract';

test('design-only entity contracts retain recorded input and error behavior', async () => {
	const contract = {
		inputs: [{ name: 'query', type: 'string' }],
		outputs: [],
		errors: [{ name: 'invalid', type: 'error' }],
		hash: 'a'.repeat(64)
	};
	expect(await hubEntityContract(undefined, { contract })).toEqual(contract);
	expect(await hubEntityContract()).toEqual({ inputs: [], outputs: [], errors: [], hash: null });
});
