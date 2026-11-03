import { measureWorkload } from '../support/measureWorkload';
import { expect, test } from 'vitest';
import { declaredContract } from '../../src/workflows/development-tooling/load-units/unit-index-service/deriveContract';

const input = (name: string, extra: Record<string, unknown> = {}) => ({
	name,
	type: 'string',
	required: false,
	description: 'Optional value.',
	...extra
});

const contractWith = (authored: object, scanned: object) =>
	declaredContract(
		{ origin: 'declared', inputs: [authored as never], outputs: [], errors: [] },
		{ origin: 'derived', inputs: [scanned as never], outputs: [], errors: [] }
	).inputs[0];

test('an authored undefined default survives a scanned optional input with no literal default', async () =>
	measureWorkload(
		'function.derive-manifest',
		'declared-undefined-default-normal-behavior',
		async () => {
			const authored = input('Chips.commit', { default: 'undefined' });
			expect(contractWith(authored, input('Chips.commit'))).toMatchObject({
				default: 'undefined'
			});
			// A scanned literal default stays authoritative.
			expect(contractWith(authored, input('Chips.commit', { default: 'none' }))).toMatchObject({
				default: 'none'
			});
			// Required inputs and other authored defaults keep the scanned shape.
			const required = { ...authored, required: true };
			expect(contractWith(required, input('Chips.commit', { required: true }))).not.toHaveProperty(
				'default'
			);
			expect(
				contractWith(input('Chips.size', { default: 'span' }), input('Chips.size'))
			).not.toHaveProperty('default');
		}
	));
