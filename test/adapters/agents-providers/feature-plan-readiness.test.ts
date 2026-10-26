import { expect, test } from 'vitest';
import { FeaturePlanReadinessAdapter } from '../../../src/adapters/agents-providers/FeaturePlanReadinessAdapter';

test('FeaturePlanReadinessAdapter.connect from default initialization returns the file name', () => {
	// => 'feature-plan-readiness'
	expect(new FeaturePlanReadinessAdapter().connect()).toBe('feature-plan-readiness');
});

test('FeaturePlanReadinessAdapter.connect from custom initialization returns the configured name', () => {
	// => 'custom'
	expect(new FeaturePlanReadinessAdapter({ name: 'custom' }).connect()).toBe('custom');
});

test('FeaturePlanReadinessAdapter.connect with invalid config throws TypeError', () => {
	const adapter = new FeaturePlanReadinessAdapter(null as never);
	// throws TypeError
	expect(() => adapter.connect()).toThrow(TypeError);
});
