import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import { comparisonDifferences } from '../../src/services/budget-service/comparisonDifferences';
import manifest from '../../specification/units/function.comparison-differences.json' with { type: 'json' };
import { measureWorkload } from '../support/measureWorkload';

// The contract's authored examples supply both the displayed result and the assertion.
new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	comparisonDifferences: (...input: Parameters<typeof comparisonDifferences>) => {
		const example = manifest.testing.examples.find(
			(item) => JSON.stringify(item.input) === JSON.stringify(input)
		);
		const call = `comparisonDifferences(${input.map((value) => JSON.stringify(value)).join(', ')})`;
		expect(example?.call, 'the displayed call uses the tested input').toBe(call);
		return measureWorkload(
			'function.comparison-differences',
			'authored-comparability-example',
			() => comparisonDifferences(...input)
		);
	}
});
