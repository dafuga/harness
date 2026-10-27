import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import type { CallableContract } from '../../src/utils/development-tooling/helperContract.types';
import { helperContract } from '../../src/utils/helperContract';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import { usageExamples } from '../../packages/reports/src/components/shared-primitives/usage-examples/usageExamples';
import unit from '../../specification/units/function.helper-contract.json' with { type: 'json' };
import { measureWorkload } from '../support/measureWorkload';

async function checked(
	input: CallableContract | { $fixture: 'throwing-consumers'; message: string }
): Promise<boolean> {
	const example = unit.testing.examples.find(
		(item) => JSON.stringify(item.input) === JSON.stringify([input])
	);
	const call =
		'$fixture' in input
			? `helperContract({ pure: true, get consumers() { throw new Error(${JSON.stringify(input.message)}); } })`
			: `helperContract(${JSON.stringify(input)})`;
	expect(example?.call, 'the displayed call uses the tested input').toBe(call);
	if (!example) throw new Error('Missing authored eligibility example');
	assertDisplayedComment(example, call);
	if ('$fixture' in input) return throwingConsumers(input.message);
	return measureWorkload('function.helper-contract', 'authored-eligibility-example', () => {
		if (input.pure === false) {
			expect(helperContract({ pure: 'true' as unknown as boolean })).toBe(false);
			expect(
				helperContract({
					pure: false,
					get consumers(): never {
						throw new Error('must not read consumers');
					}
				})
			).toBe(false);
		}
		return helperContract(input);
	});
}

function assertDisplayedComment(example: (typeof unit.testing.examples)[number], call: string) {
	const base = { name: example.name, call, input: example.input };
	const failure = example.expected.kind === 'error';
	const shown = failure
		? { ...base, error: example.expected.value }
		: { ...base, output: example.expected.value };
	const error = example.expected.value as { name: string; message: string };
	const comment = failure
		? `// throws { "name": ${JSON.stringify(error.name)}, "message": ${JSON.stringify(error.message)} }`
		: `// => ${JSON.stringify(example.expected.value)}`;
	expect(usageExamples([shown])).toEqual([`${call}\n${comment}`]);
}

function throwingConsumers(message: string): boolean {
	for (const invalid of [
		null,
		undefined,
		{ pure: true, consumers: 'invalid' },
		{ pure: true, consumers: [null] }
	])
		expect(() => helperContract(invalid as unknown as CallableContract)).toThrow(TypeError);
	return helperContract({
		pure: true,
		get consumers(): never {
			throw new Error(message);
		}
	});
}

new TestExpectationService().registerExamples(test, unit as ComponentManifest, {
	helperContract: checked
});
