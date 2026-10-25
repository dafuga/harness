import { deepStrictEqual } from 'node:assert';
import { z } from 'zod';
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
		if (!unit.helperContracts?.length) throw new Error(`Missing authored Examples for ${unit.id}`);
		for (const helper of unit.helperContracts ?? []) {
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
			this.normalize(left, path);
			this.normalize(right, path);
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
		if (Object.hasOwn(example, 'error')) {
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
	private normalize(value: unknown, path: string): void {
		const parts = this.pathParts(path);
		let parent = value;
		for (const part of parts.slice(0, -1)) {
			if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, part))
				throw new Error(`Missing normalization field ${path}`);
			parent = (parent as Record<string, unknown>)[part];
		}
		const key = parts.at(-1)!;
		if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, key))
			throw new Error(`Missing normalization field ${path}`);
		const record = parent as Record<string, unknown>;
		if (record[key] === null || typeof record[key] === 'object')
			throw new Error(`Normalization must name a scalar field: ${path}`);
		record[key] = { normalizedType: typeof record[key] };
	}
	private pathParts(path: string): string[] {
		const parts = path.split('.');
		if (
			parts.some((part) => !part || ['__proto__', 'prototype', 'constructor', '*'].includes(part))
		)
			throw new Error(`Invalid normalization path ${path}`);
		return parts;
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
