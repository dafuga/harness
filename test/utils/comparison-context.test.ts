import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import { comparisonSchema } from '../../src/core/comparisonTypes';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import {
	comparisonContext,
	requestDigest
} from '../../src/utils/comparison-context/comparisonContext';
import manifest from '../../specification/units/function.comparison-context.json' with { type: 'json' };
import { measureWorkload } from '../support/measureWorkload';

function fixture(value: unknown, kind: string): value is { $fixture: string; message: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'$fixture' in value &&
		value.$fixture === kind &&
		'message' in value &&
		typeof value.message === 'string'
	);
}

function argument(value: unknown): string {
	if (fixture(value, 'throwing-request'))
		return `{ get input() { throw new Error(${JSON.stringify(value.message)}); } }`;
	if (fixture(value, 'throwing-sampling'))
		return `{ get rounds() { throw new Error(${JSON.stringify(value.message)}); }, iterations: 30 }`;
	return JSON.stringify(value) ?? 'undefined';
}

function checked<T>(subject: string, input: unknown[], invoke: () => T): Promise<T> {
	const example = manifest.testing.examples.find(
		(item) => item.subject === subject && JSON.stringify(item.input) === JSON.stringify(input)
	);
	expect(example?.call, 'the displayed call uses the tested input').toBe(
		`${subject}(${input.map(argument).join(', ')})`
	);
	return measureWorkload('function.comparison-context', 'authored-comparison-context', invoke);
}

function request(value: unknown): unknown {
	if (!fixture(value, 'throwing-request')) return value;
	return {
		get input(): never {
			throw new Error(value.message);
		}
	};
}

function sampling(value: unknown): Parameters<typeof comparisonContext>[1] {
	if (!fixture(value, 'throwing-sampling')) return value as Parameters<typeof comparisonContext>[1];
	return {
		get rounds(): never {
			throw new Error(value.message);
		},
		iterations: 30
	};
}

function checkContext(value: ReturnType<typeof comparisonContext>): void {
	if (value.sampling.rounds === 0) {
		expect(comparisonSchema.safeParse(value).success).toBe(false);
		return;
	}
	expect(comparisonSchema.safeParse(value).success).toBe(true);
	expect(comparisonSchema.safeParse({ ...value, request: 'rank-20k' }).success).toBe(false);
	expect(comparisonSchema.safeParse({ ...value, boundary: 'inner-function' }).success).toBe(false);
	expect(comparisonSchema.safeParse({ ...value, label: 'extra' }).success).toBe(false);
}

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	requestDigest: (value: unknown) =>
		checked('requestDigest', [value], () => {
			const result = requestDigest(request(value));
			expect(result).toMatch(/^[0-9a-f]{64}$/);
			return result;
		}),
	comparisonContext: (value: unknown, counts: unknown) =>
		checked('comparisonContext', [value, counts], () => {
			if (fixture(counts, 'throwing-sampling'))
				expect(() =>
					comparisonContext(value, null as unknown as Parameters<typeof comparisonContext>[1])
				).toThrow(TypeError);
			const result = comparisonContext(request(value), sampling(counts));
			checkContext(result);
			return result;
		})
});
