import { test } from 'vitest';
import { toKebabCase } from '../src/helpers/strings/case';
import { recordExampleCases } from './support/recordExampleCases';
import { runHelperExamples } from './support/runUsageExample';
import { declaredExamples } from './support/unitExamples';

/**
 * Each declared example of a casing helper runs against the real helper. What it was given and
 * what it returned is recorded as the cases of that helper's state.
 */
const { helpers } = declaredExamples('function.case');

for (const helper of helpers) {
	test(`${helper.symbol} returns each declared example`, async () => {
		const observed = await runHelperExamples(helper, process.cwd());
		recordExampleCases(
			{
				unitId: 'function.case',
				symbol: helper.symbol,
				state: `function-case-${toKebabCase(helper.symbol)}`,
				evidence: 'helper-examples-cases',
				file: `function-case-${helper.symbol}.json`
			},
			observed
		);
	});
}
