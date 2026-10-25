import { format } from 'prettier';
import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import unit from '../../specification/units/function.stable-json.json' with { type: 'json' };
import { stableJson } from '../../src/utils/stableJson';

const options = { parser: 'json', useTabs: true, printWidth: 100 } as const;

function fixtureMarker(value: unknown): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || !Object.hasOwn(value, '$fixture')) return {};
	return value as Record<string, unknown>;
}

function propertyDescriptor(value: unknown): PropertyDescriptor {
	const marker = fixtureMarker(value);
	if (marker.$fixture === 'getter')
		return { enumerable: true, configurable: true, get: () => reconstruct(marker.value) };
	if (marker.$fixture === 'throwing-getter')
		return {
			enumerable: true,
			configurable: true,
			get() {
				throw new Error(String(marker.message));
			}
		};
	return { enumerable: true, configurable: true, writable: true, value: reconstruct(value) };
}

function rebuildObject(fields: Record<string, unknown>, target: object): object {
	for (const [key, value] of Object.entries(fields))
		Object.defineProperty(target, key, propertyDescriptor(value));
	return target;
}

const rebuilders: Record<string, (marker: Record<string, unknown>) => unknown> = {
	undefined: () => undefined,
	bigint: (marker) => BigInt(String(marker.value)),
	'prototype-and-iterator': (marker) => {
		const object = rebuildObject(
			marker.fields as Record<string, unknown>,
			Object.create({ inherited: 'ignored' })
		);
		Object.defineProperty(object, Symbol.iterator, {
			enumerable: true,
			configurable: true,
			value: function* iterator() {}
		});
		return object;
	}
};

function rebuildFixture(marker: Record<string, unknown>): unknown {
	const kind = String(marker.$fixture);
	if (!Object.hasOwn(rebuilders, kind)) throw new Error(`Unknown authored fixture ${kind}`);
	return rebuilders[kind](marker);
}

function reconstruct(value: unknown): unknown {
	if (Array.isArray(value)) return value.map((item) => reconstruct(item));
	if (typeof value !== 'object' || value === null) return value;
	if (Object.hasOwn(value, '$fixture')) return rebuildFixture(value as Record<string, unknown>);
	return rebuildObject(value as Record<string, unknown>, {});
}

async function assertPrettierStyle(): Promise<void> {
	const long = Array.from({ length: 6 }, (_, index) => `src/services/Example${index}Service.ts`);
	const values = [
		{ a: [], b: {}, c: ['x', 'y'], d: [{ k: 1, v: ['a'] }], e: long, f: { g: { h: 'i' } } },
		{ text: 'quotes " and \\ slashes / plus\nnewlines', flag: true, none: null, count: 12.5 },
		...[90, 91, 92, 93, 94, 95, 96, 97, 98].map((size) => ({ key: ['a'.repeat(size - 10), 'b'] })),
		{ nested: { deep: { list: ['a'.repeat(40), 'b'.repeat(40)] } }, last: ['z'] }
	];
	for (const value of values)
		expect(stableJson(value)).toBe(await format(JSON.stringify(value, null, '\t'), options));
}

async function invokeStableJson(...input: never[]): Promise<string> {
	const [argument] = input as unknown as [unknown];
	if (fixtureMarker(argument).$fixture === 'prettier-workload') {
		await assertPrettierStyle();
		return stableJson(reconstruct(fixtureMarker(argument).value));
	}
	return stableJson(reconstruct(argument));
}

new TestExpectationService().registerExamples(test, unit as ComponentManifest, {
	stableJson: invokeStableJson
});
