import { test } from 'vitest';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import { resourceEnvironment } from '../../src/utils/execution-runtimes/resourceEnvironment';
import { measureWorkload } from '../support/measureWorkload';
import unit from '../fixtures/contract-migration/resource-environment-examples.json' with { type: 'json' };

/** JSON cannot carry undefined, getters or prototype links, so each authored marker rebuilds them. */
function environmentFrom(argument: unknown): unknown {
	if (argument === undefined) throw new Error('Authored examples must pass an environment');
	if (typeof argument !== 'object' || argument === null) return argument;
	const fixture = fixtureName(argument);
	if (fixture === undefined) return valuesFrom({}, argument as Record<string, unknown>);
	const { values } = argument as { values: Record<string, unknown> };
	if (fixture === 'null-prototype')
		return valuesFrom(Object.create(null) as Record<string, unknown>, values);
	if (fixture === 'prototype') return Object.create(valuesFrom({}, values));
	throw new Error(`Unknown authored fixture ${String(fixture)}`);
}

function fixtureName(value: unknown): unknown {
	return (value as { $fixture?: unknown } | null)?.$fixture;
}

/** Each authored value becomes an own property; a getter marker reads its value on every access. */
function valuesFrom(target: Record<string, unknown>, values: Record<string, unknown>) {
	for (const [key, value] of Object.entries(values)) {
		const fixture = fixtureName(value);
		if (fixture === 'getter') {
			const { value: reading } = value as { value: string };
			Object.defineProperty(target, key, { enumerable: true, get: () => reading });
		} else {
			target[key] = fixture === 'undefined' ? undefined : value;
		}
	}
	return target;
}

/** Calls the public entry with the rebuilt environment, as each displayed call states. */
function invokeResourceEnvironment(...input: never[]) {
	const [argument] = input as unknown as [unknown];
	const env = environmentFrom(argument) as Record<string, string | undefined>;
	return measureWorkload('function.resource-environment', 'environment-projection', () =>
		resourceEnvironment(env)
	);
}

new TestExpectationService().registerExamples(test, unit as ComponentManifest, {
	resourceEnvironment: invokeResourceEnvironment
});
