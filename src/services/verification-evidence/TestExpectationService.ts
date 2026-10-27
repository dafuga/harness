import { deepStrictEqual } from 'node:assert';
import { testJsonSchema } from '../../core/verification-evidence/testJsonSchema';
import { TestCaseValidator } from '../../validators/verification-evidence/TestCaseValidator';
import { normalizeJson } from './test-expectation-service/normalizeJson';
import type { UsageExample } from '../../utils/explorer-ui/unit-documentation/unitDocumentation.types';
import type { ExampleInvocation, ExampleObservation } from './TestExpectationService.types';
import type { ExampleRegistrar, ExampleFunctions } from './TestExpectationService.types';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type { ContractCase } from './TestContractService.types';

/** Expectations come from authored contracts, never from the execution being checked. */
export class TestExpectationService {
	registerCases(
		register: ExampleRegistrar,
		unit: ComponentManifest,
		file: string,
		functions: Readonly<Record<string, () => unknown>>
	): void {
		const contract = unit.testing;
		if (!contract || !['service', 'api'].includes(contract.shape))
			throw new Error('Case registration requires class or API contracts');
		const admission = new TestCaseValidator().validate(unit, contract);
		if (!admission.valid) throw new Error(`Invalid case contract: ${admission.errors.join('; ')}`);
		const cases = contract.cases.filter((item) => item.test.file === file);
		if (!cases.length) throw new Error(`No declared cases for ${file}`);
		for (const id of Object.keys(functions))
			if (!cases.some((item) => item.id === id))
				throw new Error(`Unsupported case implementation: ${id}`);
		for (const item of cases) {
			const invoke = functions[item.id];
			if (!invoke) throw new Error(`Missing case implementation: ${item.id}`);
			register(item.test.title, async () => {
				if (contract.shape === 'api' && item.expected?.kind === 'json')
					this.json(await invoke(), item.expected.value, item.expected.normalize);
				else await this.example(invoke, registeredExample(item));
			});
		}
	}
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
		assertExampleImplementations(functions, groups);
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
		const left = globalThis.structuredClone(testJsonSchema.parse(actual));
		const right = globalThis.structuredClone(testJsonSchema.parse(expected));
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
			if (!Object.hasOwn(example, 'error')) throw unexpectedExampleFailure(error);
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

function registeredExample(item: ContractCase): UsageExample {
	const expected = item.expected;
	if (!expected || expected.kind === 'json' || expected.kind === 'screenshot')
		throw new Error('Class cases require an authored value, error or void result');
	return usageExample({
		subject: item.subject ?? '',
		name: item.test.title,
		call: item.call ?? item.test.title,
		input: item.input ?? null,
		expected
	});
}

function assertExampleImplementations(
	functions: ExampleFunctions,
	groups: ReturnType<typeof exampleGroups>
): void {
	for (const name of Object.keys(functions))
		if (!groups.some((group) => group.name === name))
			throw new Error(`Unsupported example implementation: ${name}`);
}

/** Unexpected invocation failures keep their original value and actionable message. */
function unexpectedExampleFailure(error: unknown): Error {
	let detail = 'non-Error value thrown';
	if (error instanceof Error) detail = error.message;
	else if (typeof error === 'string') detail = error;
	return new Error(`Example unexpectedly failed: ${detail}`, { cause: error });
}
