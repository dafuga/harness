import { deepStrictEqual } from 'node:assert';
import { z } from 'zod';
import { TestCaseValidator } from '../../validators/verification-evidence/TestCaseValidator';
import { normalizeJson } from './test-expectation-service/normalizeJson';
import type { UsageExample } from '../../utils/explorer-ui/unit-documentation/unitDocumentation.types';
import type { ExampleInvocation, ExampleObservation } from './TestExpectationService.types';
import type { ExampleRegistrar, ExampleFunctions } from './TestExpectationService.types';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';

/** Expectations come from authored contracts, never from the execution being checked. */
export class TestExpectationService {
	registerExamples(
		register: ExampleRegistrar,
		unit: ComponentManifest,
		functions: ExampleFunctions
	): void {
		const groups = exampleGroups(unit);
		if (!groups.length) throw new Error(`Missing authored Examples for ${unit.id}`);
		if (unit.testing?.shape !== 'helper')
			throw new Error('Example registration requires the helper test shape');
		const admission = new TestCaseValidator().validate(unit, unit.testing);
		if (!admission.valid)
			throw new Error(`Invalid authored Examples: ${admission.errors.join('; ')}`);
		for (const helper of groups) {
			const invoke = functions[helper.name];
			if (!invoke || !helper.examples?.length)
				throw new Error(`Missing executable examples for ${helper.name}`);
			for (const example of helper.examples)
				register(`${helper.name}: ${example.name}`, async () => {
					await this.example(
						(input) => invoke(...((Array.isArray(input) ? input : [input]) as never[])),
						example
					);
				});
		}
	}
	json(actual: unknown, expected: unknown, normalize: string[] = []): void {
		const left = globalThis.structuredClone(z.json().parse(actual));
		const right = globalThis.structuredClone(z.json().parse(expected));
		for (const path of normalize) {
			normalizeJson(left, path);
			normalizeJson(right, path);
		}
		deepStrictEqual(left, right, 'API JSON differs from its authored response');
	}
	async example(invoke: ExampleInvocation, example: UsageExample): Promise<ExampleObservation> {
		let observation: ExampleObservation;
		try {
			observation = {
				name: example.name,
				input: example.input,
				output: await invoke(example.input)
			};
		} catch (error) {
			observation = {
				name: example.name,
				input: example.input,
				error: this.errorValue(error, example.error)
			};
		}
		if (example.returns === 'void') {
			deepStrictEqual(Object.hasOwn(observation, 'error'), false, 'Example unexpectedly failed');
			deepStrictEqual(observation.output, undefined, 'Example output differs from its comment');
		} else if (Object.hasOwn(example, 'error')) {
			deepStrictEqual(Object.hasOwn(observation, 'error'), true, 'Expected example to fail');
			deepStrictEqual(observation.error, example.error, 'Example error differs from its comment');
		} else {
			deepStrictEqual(Object.hasOwn(observation, 'error'), false, 'Example unexpectedly failed');
			deepStrictEqual(
				observation.output,
				example.output,
				'Example output differs from its comment'
			);
		}
		return observation;
	}
	private errorValue(error: unknown, expected: unknown): unknown {
		if (!(error instanceof Error)) return error;
		if (typeof expected === 'string') return error.message;
		return {
			name: error.name,
			message: error.message,
			...Object.fromEntries(Object.entries(error))
		};
	}
}
export type { ExampleInvocation, ExampleObservation } from './TestExpectationService.types';

function usageExample(
	item: NonNullable<NonNullable<ComponentManifest['testing']>['examples']>[number]
): UsageExample {
	const example = { name: item.name, call: item.call, input: item.input };
	if (item.expected.kind === 'void') return { ...example, returns: 'void' };
	if (item.expected.kind === 'error') return { ...example, error: item.expected.value };
	return { ...example, output: item.expected.value };
}

function exampleGroups(unit: ComponentManifest) {
	return [
		...(unit.helperContracts ?? []),
		...(unit.testing?.examples ?? []).map((item) => ({
			name: item.subject,
			examples: [usageExample(item)]
		}))
	];
}
