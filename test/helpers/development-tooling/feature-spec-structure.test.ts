import { describe, expect, test } from 'vitest';
import { featureSpecStructure } from '../../../src/helpers/development-tooling/featureSpecStructure';

describe('featureSpecStructure', () => {
	test('trims surrounding whitespace', () => {
		// => 'label'
		expect(featureSpecStructure('  label  ')).toEqual('label');
	});

	test('returns blank for whitespace-only input', () => {
		// => ''
		expect(featureSpecStructure('   ')).toEqual('');
	});

	test('rejects non-text input', () => {
		// throws 'featureSpecStructure expects text'
		expect(() => featureSpecStructure(42 as never)).toThrow('featureSpecStructure expects text');
	});
});
