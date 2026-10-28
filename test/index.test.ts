import { expect, test } from 'vitest';
import { helloHarness } from '../src';
import unit from '../specification/units/entry.index.json';

test('helloHarness: returns a greeting', () => {
	expect(helloHarness()).toEqual(unit.testing.examples[0].expected.value);
});
