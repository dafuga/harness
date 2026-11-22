import { measureWorkload } from '../support/measureWorkload';
import { expect, test } from 'vitest';
import { declaredContract } from '../../src/workflows/development-tooling/load-units/unit-index-service/deriveContract';

const scanned = (name: string) => ({
	name,
	inputs: [],
	outputs: [],
	errors: [],
	errorStatus: 'unknown' as const
});

test('declared operation errors replace scanned unknowns; undeclared operations stay scanned', async () =>
	measureWorkload(
		'function.derive-manifest',
		'declared-operation-errors-normal-behavior',
		async () => {
			const contract = declaredContract(
				{
					origin: 'declared',
					inputs: [],
					outputs: [],
					errors: [],
					operations: [
						{ ...scanned('pure'), errorStatus: 'declared' },
						{
							...scanned('callback'),
							errors: [{ name: 'callback error', type: 'thrown' }],
							errorStatus: 'declared'
						}
					]
				},
				{
					origin: 'derived',
					inputs: [],
					outputs: [],
					errors: [],
					operations: [scanned('pure'), scanned('callback'), scanned('other')]
				}
			);
			expect(
				contract.operations?.map((operation) => [
					operation.name,
					operation.errorStatus,
					operation.errors.length
				])
			).toEqual([
				['pure', 'declared', 0],
				['callback', 'declared', 1],
				['other', 'unknown', 0]
			]);
		}
	));
