import { describe, expect, test } from 'vitest';
import { featurePlanGraphUncertainty } from '../../../src/helpers/agents-providers/featurePlanGraphUncertainty';

describe('featurePlanGraphUncertainty', () => {
	test('trims surrounding whitespace', () => {
		// => 'label'
		expect(featurePlanGraphUncertainty('  label  ')).toEqual('label');
	});

	test('returns blank for whitespace-only input', () => {
		// => ''
		expect(featurePlanGraphUncertainty('   ')).toEqual('');
	});

	test('rejects non-text input', () => {
		// throws 'featurePlanGraphUncertainty expects text'
		expect(() => featurePlanGraphUncertainty(42 as never)).toThrow('featurePlanGraphUncertainty expects text');
	});
});
