import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import { historyRefs, refKind, sourceArchiveRef } from '../../src/utils/historyRefs';
import manifest from '../../specification/units/function.history-refs.json' with { type: 'json' };
import { measureWorkload } from '../support/measureWorkload';

function checked<T>(subject: string, input: unknown[], invoke: () => T): Promise<T> {
	const example = manifest.testing.examples.find(
		(item) => item.subject === subject && JSON.stringify(item.input) === JSON.stringify(input)
	);
	const call = `${subject}(${input.map(exampleArgument).join(', ')})`;
	expect(example?.call, 'the displayed call uses the tested input').toBe(call);
	return measureWorkload('function.history-refs', 'authored-history-ref-example', invoke);
}

function exampleArgument(value: unknown): string {
	if (isThrowingReference(value))
		return `{ startsWith() { throw new TypeError(${JSON.stringify(value.message)}); } }`;
	return JSON.stringify(value) ?? 'undefined';
}

function isThrowingReference(value: unknown): value is { $fixture: string; message: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'$fixture' in value &&
		value.$fixture === 'throwing-reference' &&
		'message' in value &&
		typeof value.message === 'string'
	);
}

function reference(value: unknown): string {
	if (!isThrowingReference(value)) return value as string;
	// Native messages vary by runtime, so these invalid props assert the error type directly.
	expect(() => refKind(null as unknown as string)).toThrow(TypeError);
	expect(() => refKind({} as unknown as string)).toThrow(TypeError);
	return {
		startsWith() {
			throw new TypeError(value.message);
		}
	} as unknown as string;
}

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	refKind: (ref: unknown) => checked('refKind', [ref], () => refKind(reference(ref))),
	sourceArchiveRef: (commit: string) =>
		checked('sourceArchiveRef', [commit], () => sourceArchiveRef(commit)),
	historyRefs: () => checked('historyRefs', [], () => historyRefs())
});
